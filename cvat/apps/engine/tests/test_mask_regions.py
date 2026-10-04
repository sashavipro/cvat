# Copyright (C) CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

import io
from unittest.mock import MagicMock
from django.contrib.auth import get_user_model
from django.test import TestCase

User = get_user_model()
from PIL import Image
import numpy as np

from rest_framework.exceptions import ValidationError

from cvat.apps.engine.models import (
    Data,
    FrameMaskRegion,
    Job,
    JobType,
    Segment,
    SegmentType,
    Task,
)
from cvat.apps.engine.serializers import (
    FrameMaskRegionReadSerializer,
    FrameMaskRegionWriteSerializer,
)
from cvat.apps.engine.mask_utils import (
    apply_masks_to_pil_image,
    apply_masks_to_cv_image,
    apply_masks_to_image_bytes,
)
from cvat.apps.engine.permissions import FrameMaskRegionPermission


class TestMaskRegionModel(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="password")
        self.data = Data.objects.create(size=10)
        self.task = Task.objects.create(name="Test Task", owner=self.user, data=self.data)
        self.segment = Segment.objects.create(
            task=self.task, start_frame=0, stop_frame=9, type=SegmentType.RANGE
        )
        self.job = Job.objects.create(segment=self.segment, type=JobType.ANNOTATION)

    def test_create_frame_mask_region(self):
        region = FrameMaskRegion.objects.create(
            job=self.job,
            frame=2,
            points=[10.0, 15.0, 50.0, 60.0],
            z_order=1,
            owner=self.user,
        )
        self.assertIsNotNone(region.id)
        self.assertEqual(region.job, self.job)
        self.assertEqual(region.frame, 2)
        self.assertEqual(region.points, [10.0, 15.0, 50.0, 60.0])
        self.assertEqual(region.z_order, 1)
        self.assertEqual(region.owner, self.user)
        self.assertIsNotNone(region.created_date)
        self.assertIsNotNone(region.updated_date)

    def test_query_filter_by_job_and_frame(self):
        FrameMaskRegion.objects.create(
            job=self.job, frame=0, points=[0, 0, 10, 10], owner=self.user
        )
        FrameMaskRegion.objects.create(
            job=self.job, frame=1, points=[20, 20, 30, 30], owner=self.user
        )

        regions_frame0 = FrameMaskRegion.objects.filter(job=self.job, frame=0)
        self.assertEqual(regions_frame0.count(), 1)
        self.assertEqual(regions_frame0.first().points, [0, 0, 10, 10])

        regions_frame1 = FrameMaskRegion.objects.filter(job=self.job, frame=1)
        self.assertEqual(regions_frame1.count(), 1)

    def test_cascade_delete_on_job_delete(self):
        FrameMaskRegion.objects.create(
            job=self.job, frame=3, points=[1, 2, 3, 4], owner=self.user
        )
        self.assertEqual(FrameMaskRegion.objects.filter(job=self.job).count(), 1)

        self.job.delete()
        self.assertEqual(FrameMaskRegion.objects.count(), 0)


class TestMaskRegionSerializers(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="testuser2", password="password")
        self.data = Data.objects.create(size=10)
        self.task = Task.objects.create(name="Test Task 2", owner=self.user, data=self.data)
        self.segment = Segment.objects.create(
            task=self.task, start_frame=0, stop_frame=9, type=SegmentType.RANGE
        )
        self.job = Job.objects.create(segment=self.segment, type=JobType.ANNOTATION)

    def test_valid_rectangle_serializer(self):
        serializer = FrameMaskRegionWriteSerializer(
            data={"job": self.job.id, "frame": 3, "points": [10, 20, 100, 200], "z_order": 0}
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        saved = serializer.save(owner=self.user)
        self.assertEqual(saved.points, [10, 20, 100, 200])

    def test_valid_polygon_serializer(self):
        serializer = FrameMaskRegionWriteSerializer(
            data={
                "job": self.job.id,
                "frame": 1,
                "points": [10, 10, 20, 50, 40, 20],
                "z_order": 2,
            }
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_invalid_points_not_enough_coordinates(self):
        serializer = FrameMaskRegionWriteSerializer(
            data={"job": self.job.id, "frame": 1, "points": [10, 20, 30]}
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("points", serializer.errors)

    def test_invalid_points_odd_length_polygon(self):
        serializer = FrameMaskRegionWriteSerializer(
            data={"job": self.job.id, "frame": 1, "points": [10, 20, 30, 40, 50]}
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("points", serializer.errors)

    def test_invalid_points_non_numeric(self):
        serializer = FrameMaskRegionWriteSerializer(
            data={"job": self.job.id, "frame": 1, "points": [10, "abc", 30, 40]}
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("points", serializer.errors)

    def test_invalid_frame_out_of_bounds(self):
        serializer = FrameMaskRegionWriteSerializer(
            data={"job": self.job.id, "frame": 999, "points": [0, 0, 10, 10]}
        )
        self.assertFalse(serializer.is_valid())
        self.assertTrue("frame" in serializer.errors or "non_field_errors" in serializer.errors)

    def test_read_serializer(self):
        region = FrameMaskRegion.objects.create(
            job=self.job, frame=5, points=[5, 5, 25, 25], owner=self.user
        )
        read_serializer = FrameMaskRegionReadSerializer(instance=region, context={"request": MagicMock()})
        data = read_serializer.data
        self.assertEqual(data["id"], region.id)
        self.assertEqual(data["job"], self.job.id)
        self.assertEqual(data["frame"], 5)
        self.assertEqual(data["points"], [5, 5, 25, 25])
        self.assertEqual(data["owner"]["username"], self.user.username)


class TestMaskUtils(TestCase):
    def test_apply_masks_to_pil_image(self):
        # Create a 100x100 white image
        image = Image.new("RGB", (100, 100), color=(255, 255, 255))
        mask_region = MagicMock()
        mask_region.points = [10, 10, 40, 40]

        apply_masks_to_pil_image(image, [mask_region])

        # Pixels inside the redacted region should be black
        self.assertEqual(image.getpixel((20, 20)), (0, 0, 0))
        self.assertEqual(image.getpixel((10, 10)), (0, 0, 0))

        # Pixels outside should remain white
        self.assertEqual(image.getpixel((5, 5)), (255, 255, 255))
        self.assertEqual(image.getpixel((50, 50)), (255, 255, 255))

    def test_apply_masks_to_cv_image(self):
        # Create a 100x100 white numpy image
        img = np.full((100, 100, 3), 255, dtype=np.uint8)
        mask_region = MagicMock()
        mask_region.points = [20, 20, 60, 60]

        apply_masks_to_cv_image(img, [mask_region])

        # Inside mask should be black
        np.testing.assert_array_equal(img[30, 30], [0, 0, 0])
        # Outside mask should remain white
        np.testing.assert_array_equal(img[10, 10], [255, 255, 255])
        np.testing.assert_array_equal(img[80, 80], [255, 255, 255])

    def test_apply_masks_to_image_bytes(self):
        # Create a test JPEG
        image = Image.new("RGB", (100, 100), color=(255, 255, 255))
        buffer = io.BytesIO()
        image.save(buffer, format="JPEG")
        buffer.seek(0)

        mask_region = MagicMock()
        mask_region.points = [10, 10, 50, 50]

        output_buffer = apply_masks_to_image_bytes(buffer, [mask_region], mime="image/jpeg")
        output_buffer.seek(0)

        # Verify output image has masked area
        result_img = Image.open(output_buffer)
        pixel_inside = result_img.getpixel((25, 25))
        self.assertLess(pixel_inside[0], 10)  # JPEG compression may have slight variance near 0
        self.assertLess(pixel_inside[1], 10)
        self.assertLess(pixel_inside[2], 10)

        pixel_outside = result_img.getpixel((80, 80))
        self.assertGreater(pixel_outside[0], 240)
        self.assertGreater(pixel_outside[1], 240)
        self.assertGreater(pixel_outside[2], 240)

    def test_clamp_points_beyond_boundaries(self):
        image = Image.new("RGB", (50, 50), color=(255, 255, 255))
        mask_region = MagicMock()
        # Points going negative and beyond 50
        mask_region.points = [-20, -10, 100, 80]

        # Should safely clamp to image bounds without throwing IndexError
        apply_masks_to_pil_image(image, [mask_region])
        self.assertEqual(image.getpixel((25, 25)), (0, 0, 0))


class TestMaskPermissions(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="owner_user", password="password")
        self.annotator = User.objects.create_user(username="annotator_user", password="password")
        self.admin = User.objects.create_superuser(
            username="admin_user", password="password", email="admin@test.com"
        )
        self.data = Data.objects.create(size=10)
        self.task = Task.objects.create(name="Perm Task", owner=self.owner, data=self.data)
        self.segment = Segment.objects.create(
            task=self.task, start_frame=0, stop_frame=9, type=SegmentType.RANGE
        )
        self.job = Job.objects.create(
            segment=self.segment, assignee=self.annotator, type=JobType.ANNOTATION
        )

    def test_view_original_scope_superuser(self):
        request = MagicMock()
        request.user = self.admin
        request.iam_context = {"privilege": "admin", "organization_specified": False}
        perm = FrameMaskRegionPermission.create_scope_view_original(request, self.job)
        self.assertTrue(perm.check_access().allow)

    def test_view_original_scope_owner(self):
        request = MagicMock()
        request.user = self.owner
        request.iam_context = {"privilege": "user", "organization_specified": False}
        perm = FrameMaskRegionPermission.create_scope_view_original(request, self.job)
        self.assertTrue(perm.check_access().allow)
