# Copyright (C) CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

import json
from http import HTTPStatus
import pytest
from deepdiff import DeepDiff

from shared.utils.config import make_api_client


@pytest.mark.usefixtures("restore_db_per_function")
class TestMaskRegionsApi:
    def test_create_list_update_delete_mask(self, admin_user, jobs):
        job_id = jobs[0]["id"]

        with make_api_client(admin_user) as client:
            # 1. Initially, masks list should be empty
            response = client.api_client.call_api(
                f"/api/jobs/{job_id}/masks",
                "GET",
                _return_http_data_only=False,
            )
            assert response[1] == HTTPStatus.OK
            data = json.loads(response[0].data)
            assert len(data) == 0

            # 2. Create a mask region
            mask_data = {
                "job": job_id,
                "frame": 0,
                "points": [10.0, 20.0, 100.0, 150.0],
                "z_order": 0,
            }
            create_response = client.api_client.call_api(
                f"/api/jobs/{job_id}/masks",
                "POST",
                body=mask_data,
                _return_http_data_only=False,
            )
            assert create_response[1] == HTTPStatus.CREATED
            created = json.loads(create_response[0].data)
            mask_id = created["id"]
            assert created["frame"] == 0
            assert created["points"] == [10.0, 20.0, 100.0, 150.0]

            # 3. List masks, filtering by frame
            list_response = client.api_client.call_api(
                f"/api/jobs/{job_id}/masks?frame=0",
                "GET",
                _return_http_data_only=False,
            )
            assert list_response[1] == HTTPStatus.OK
            list_data = json.loads(list_response[0].data)
            assert len(list_data) == 1
            assert list_data[0]["id"] == mask_id

            # 4. Patch mask region
            patch_data = {"points": [15.0, 25.0, 110.0, 160.0]}
            patch_response = client.api_client.call_api(
                f"/api/masks/{mask_id}",
                "PATCH",
                body=patch_data,
                _return_http_data_only=False,
            )
            assert patch_response[1] == HTTPStatus.OK
            patched = json.loads(patch_response[0].data)
            assert patched["points"] == [15.0, 25.0, 110.0, 160.0]

            # 5. Delete mask region
            del_response = client.api_client.call_api(
                f"/api/masks/{mask_id}",
                "DELETE",
                _return_http_data_only=False,
            )
            assert del_response[1] == HTTPStatus.NO_CONTENT

            # Verify deletion
            verify_response = client.api_client.call_api(
                f"/api/jobs/{job_id}/masks",
                "GET",
                _return_http_data_only=False,
            )
            assert len(json.loads(verify_response[0].data)) == 0

    def test_original_frame_permission(self, admin_user, regular_user, jobs):
        job_id = jobs[0]["id"]

        # Admin user can request original unmasked frame
        with make_api_client(admin_user) as client:
            resp = client.api_client.call_api(
                f"/api/jobs/{job_id}/data?type=frame&number=0&original=true",
                "GET",
                _return_http_data_only=False,
                _check_status=False,
            )
            assert resp[1] == HTTPStatus.OK

        # Regular user without permissions gets 403 Forbidden
        with make_api_client(regular_user) as client:
            resp = client.api_client.call_api(
                f"/api/jobs/{job_id}/data?type=frame&number=0&original=true",
                "GET",
                _return_http_data_only=False,
                _check_status=False,
            )
            assert resp[1] in (HTTPStatus.FORBIDDEN, HTTPStatus.NOT_FOUND)
