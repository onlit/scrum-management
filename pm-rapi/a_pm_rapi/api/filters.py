"""
Provides generic filtering backends that can be used to filter the results
returned by list views.
"""
import operator
from functools import reduce

from django.core.exceptions import ImproperlyConfigured
from django.db import models
from django.db.models.constants import LOOKUP_SEP
from django.template import loader
from django.utils.encoding import force_str
from django.utils.translation import gettext_lazy as _

from rest_framework.compat import coreapi, coreschema
from rest_framework.settings import api_settings
from django.db.models import CharField, TextField, EmailField, SlugField, URLField
from rest_framework.filters import BaseFilterBackend
from django_filters.rest_framework import DjangoFilterBackend as ExDjangoFilterBackend
import django_filters
from a_pm_rapi.models import Bug, Task, TaskStatus, status_choices


class BugFilterset(django_filters.FilterSet):
    status = django_filters.MultipleChoiceFilter(
        field_name='status',
        lookup_expr='contains',
        choices=status_choices,
    )
    labels = django_filters.CharFilter(
        field_name='labels',
        lookup_expr='icontains',
    )

    class Meta:
        model = Bug
        exclude = ['only_these_roles_can_see_it',
                   'only_these_users_can_see_it']
        filter_overrides = {
            models.JSONField: {
                'filter_class': django_filters.CharFilter,
                'extra': lambda f: {
                    'lookup_expr': 'icontains',
                },
            },
        }


class TaskFilterset(django_filters.FilterSet):
    status = django_filters.ModelMultipleChoiceFilter(
        field_name='status',
        queryset=TaskStatus.objects.all(),
    )
    parent_task_null = django_filters.CharFilter(method='parent_task_null')
    parent_task_not_null = django_filters.CharFilter(method='parent_task_not_null')

    def parent_task_null(self, queryset, value, *args, **kwargs):
        return queryset.filter(parent_task__isnull=True)

    def parent_task_not_null(self, queryset, value, *args, **kwargs):
        return queryset.filter(parent_task__isnull=False)

    class Meta:
        model = Task
        exclude = ['rrule', 'only_these_roles_can_see_it',
                   'only_these_users_can_see_it']


class DjangoFilterBackend(ExDjangoFilterBackend):
    def get_filterset_class(self, view, queryset=None):
        MetaBase = getattr(self.filterset_base, 'Meta', object)
        filterset_fields = getattr(view, 'filterset_fields', None)
        filterset_exclude = getattr(view, 'filterset_exclude', None)
        filterset_class = getattr(view, 'filterset_class', None)

        class AutoFilterSet(self.filterset_base):
            class Meta(MetaBase):
                model = queryset.model
                if filterset_fields:
                    fields = filterset_fields
                elif filterset_exclude:
                    exclude = filterset_exclude
                filter_overrides = {
                    models.JSONField: {
                        'filter_class': django_filters.CharFilter,
                        'extra': lambda f: {
                            'lookup_expr': 'icontains',
                        },
                    },
                }

        if not filterset_class:
            view.filterset_class = AutoFilterSet

        filterset = super().get_filterset_class(view, queryset)
        return filterset


class CustomSearchFilter(object):

    @staticmethod
    def filter_queryset(query_param, search_fields, queryset):
        if not query_param:
            return queryset

        search_terms = query_param.replace('\x00', '').replace(',', ' ').split()

        orm_lookups = [
            LOOKUP_SEP.join([str(search_field), "icontains"])
            for search_field in search_fields
        ]

        base = queryset

        conditions = []
        for search_term in search_terms:
            queries = [
                models.Q(**{orm_lookup: search_term})
                for orm_lookup in orm_lookups
            ]
            conditions.append(reduce(operator.or_, queries))

        queryset = queryset.filter(reduce(operator.and_, conditions))

        return queryset


class SearchFilter(BaseFilterBackend):
    # The URL query parameter used for the search.
    search_param = api_settings.SEARCH_PARAM
    template = 'rest_framework/filters/search.html'
    lookup_prefixes = {
        '^': 'istartswith',
        '=': 'iexact',
        '@': 'search',
        '$': 'iregex',
    }
    search_title = _('Search')
    search_description = _('A search term.')

    def get_search_fields(self, view, request):
        """
        Search fields are obtained from the view, but the request is always
        passed to this method. Sub-classes can override this method to
        dynamically change the search fields based on request content.
        """
        model = view.get_serializer().Meta.model
        return [f.name for f in model._meta.fields if isinstance(f, CharField) or isinstance(f, TextField) or isinstance(f, EmailField) or isinstance(f, URLField) or isinstance(f, SlugField)]

    def get_search_terms(self, request):
        """
        Search terms are set by a ?search=... query parameter,
        and may be comma and/or whitespace delimited.
        """
        params = request.query_params.get(self.search_param, '')
        params = params.replace('\x00', '')  # strip null characters
        params = params.replace(',', ' ')
        return params.split()

    def construct_search(self, field_name):
        lookup = self.lookup_prefixes.get(field_name[0])
        if lookup:
            field_name = field_name[1:]
        else:
            lookup = 'icontains'
        return LOOKUP_SEP.join([field_name, lookup])

    def must_call_distinct(self, queryset, search_fields):
        """
        Return True if 'distinct()' should be used to query the given lookups.
        """
        for search_field in search_fields:
            opts = queryset.model._meta
            if search_field[0] in self.lookup_prefixes:
                search_field = search_field[1:]
            # Annotated fields do not need to be distinct
            if isinstance(queryset, models.QuerySet) and search_field in queryset.query.annotations:
                continue
            parts = search_field.split(LOOKUP_SEP)
            for part in parts:
                field = opts.get_field(part)
                if hasattr(field, 'get_path_info'):
                    # This field is a relation, update opts to follow the relation
                    path_info = field.get_path_info()
                    opts = path_info[-1].to_opts
                    if any(path.m2m for path in path_info):
                        # This field is a m2m relation so we know we need to call distinct
                        return True
                else:
                    # This field has a custom __ query transform but is not a relational field.
                    break
        return False

    def filter_queryset(self, request, queryset, view):
        search_fields = self.get_search_fields(view, request)
        search_terms = self.get_search_terms(request)

        if not search_fields or not search_terms:
            return queryset

        orm_lookups = [
            self.construct_search(str(search_field))
            for search_field in search_fields
        ]

        base = queryset
        conditions = []
        for search_term in search_terms:
            queries = [
                models.Q(**{orm_lookup: search_term})
                for orm_lookup in orm_lookups
            ]
            conditions.append(reduce(operator.or_, queries))
        queryset = queryset.filter(reduce(operator.and_, conditions))

        if self.must_call_distinct(queryset, search_fields):
            # inspired by django.contrib.admin
            # this is more accurate than .distinct form M2M relationship
            # also is cross-database
            queryset = queryset.filter(pk=models.OuterRef('pk'))
            queryset = base.filter(models.Exists(queryset))
        return queryset

    def to_html(self, request, queryset, view):
        if not getattr(view, 'search_fields', None):
            return ''

        term = self.get_search_terms(request)
        term = term[0] if term else ''
        context = {
            'param': self.search_param,
            'term': term
        }
        template = loader.get_template(self.template)
        return template.render(context)

    def get_schema_fields(self, view):
        assert coreapi is not None, 'coreapi must be installed to use `get_schema_fields()`'
        assert coreschema is not None, 'coreschema must be installed to use `get_schema_fields()`'
        return [
            coreapi.Field(
                name=self.search_param,
                required=False,
                location='query',
                schema=coreschema.String(
                    title=force_str(self.search_title),
                    description=force_str(self.search_description)
                )
            )
        ]

    def get_schema_operation_parameters(self, view):
        return [
            {
                'name': self.search_param,
                'required': False,
                'in': 'query',
                'description': force_str(self.search_description),
                'schema': {
                    'type': 'string',
                },
            },
        ]
