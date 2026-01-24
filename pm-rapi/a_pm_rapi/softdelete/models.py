from django.db import models
from django.utils import timezone
from django.db.models.fields.related_descriptors import ReverseManyToOneDescriptor, ReverseOneToOneDescriptor


class SoftDeleteQuerySet(models.query.QuerySet):
    def delete(self, cascade=True, updated_by=None):
        update_kwargs = {
            "is_deleted": True,
            "deleted_at": timezone.now()
        }
        if updated_by: update_kwargs["updated_by"] = updated_by
        if cascade:  # delete one by one if cascade
            for obj in self.all():
                obj.delete(cascade=cascade, updated_by=updated_by)
        return self.update(**update_kwargs)

    def hard_delete(self):
        return super().delete()


class SoftDeleteManager(models.Manager):
    def get_queryset(self):
        return SoftDeleteQuerySet(self.model, using=self._db).filter(is_deleted=False, _template=False)


class DeletedQuerySet(models.query.QuerySet):
    def restore(self, cascade=True, *args, **kwargs):
        qs = self.filter(*args, **kwargs)
        for obj in qs:
            obj.restore()


class DeletedManager(models.Manager):
    def get_queryset(self):
        return DeletedQuerySet(self.model, using=self._db).filter(is_deleted=True)


class TemplateManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False, _template=True)


class SoftDeleteModel(models.Model):
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(blank=True, null=True)

    objects = SoftDeleteManager()
    deleted_objects = DeletedManager()
    template_objects = TemplateManager()

    class Meta:
        abstract = True

    def delete(self, cascade=True, updated_by=None, *args, **kwargs):
        if updated_by:
            self.updated_by = updated_by
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save()
        self.after_delete()
        if cascade:
            self.delete_related_objects()

    def restore(self, cascade=True):
        self.is_deleted = False
        self.deleted_at = None
        self.save()
        self.after_restore()
        if cascade:
            self.restore_related_objects()

    def hard_delete(self, *args, **kwargs):
        super().delete(*args, **kwargs)

    def get_related_objects(self, manager="objects"):
        attributes = vars(self._meta.model)
        reverse_attributes = [a for a, b in attributes.items() if type(b) in [ReverseManyToOneDescriptor, ReverseOneToOneDescriptor]]
        related_objects = []
        for reverse_attribute in reverse_attributes:
            try:
                related_objects.extend(list(getattr(self, reverse_attribute)(manager=manager).all()))
            except:
                pass
        return related_objects

    def delete_related_objects(self):
        for obj in self.get_related_objects():
            obj.delete()

    def restore_related_objects(self):
        for obj in self.get_related_objects(manager="deleted_objects"):
            obj.restore()

    def after_delete(self):
        pass

    def after_restore(self):
        pass