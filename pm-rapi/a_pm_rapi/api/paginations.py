from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


DEFAULT_PAGE = 1
DEFAULT_PAGE_SIZE = 10

class CustomPagination(PageNumberPagination):
    page = DEFAULT_PAGE
    page_size = DEFAULT_PAGE_SIZE
    page_size_query_param = 'page_size'

    def get_paginated_response(self, data):
        return Response({
            'totalCount': self.page.paginator.count,
            'pageCount': self.page.paginator.num_pages,
            'currentPage': int(self.request.GET.get('page', DEFAULT_PAGE)),
            'perPage': int(self.request.GET.get('page_size', self.page_size)),
            'results': data
        })