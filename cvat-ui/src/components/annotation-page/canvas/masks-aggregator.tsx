// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import { useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Canvas } from 'cvat-canvas-wrapper';
import { CombinedState } from 'reducers';
import {
    fetchMaskRegionsAsync, masksActions, createMaskRegionAsync,
    updateMaskRegionAsync, deleteMaskRegionAsync,
} from 'actions/masks-actions';

export default function MasksAggregatorComponent(): null {
    const dispatch = useDispatch();

    const {
        jobInstance,
        canvasInstance,
        canvasIsReady,
        frameMaskRegions,
        viewOriginal,
        user,
        selectedColor,
        activeMaskType,
        hiddenMasks,
    } = useSelector((state: CombinedState) => ({
        jobInstance: state.annotation.job.instance,
        canvasInstance: state.annotation.canvas.instance,
        canvasIsReady: state.annotation.canvas.ready,
        frameMaskRegions: state.masks.frameMaskRegions,
        viewOriginal: state.masks.viewOriginal,
        user: state.auth.user,
        selectedColor: state.masks.selectedColor,
        activeMaskType: state.masks.activeMaskType,
        hiddenMasks: state.masks.hiddenMasks || [],
    }));

    const selectedColorRef = useRef(selectedColor);
    selectedColorRef.current = selectedColor;
    const activeMaskTypeRef = useRef(activeMaskType);
    activeMaskTypeRef.current = activeMaskType;

    const canvasReady = canvasInstance instanceof Canvas && canvasIsReady;

    const getVisibleMasks = (): any[] => {
        if (viewOriginal) return [];
        return frameMaskRegions.filter((r: any) => {
            const maskId = r.track_id ?? r.trackId ?? `shape_${r.id}`;
            return !hiddenMasks.includes(maskId);
        });
    };

    // Compute canViewOriginal from auth.user + job instance
    useEffect(() => {
        if (jobInstance && user) {
            const isSuperuser = !!(user.isSuperuser || (user as any).privilege === 'admin');
            const isTaskOwner = jobInstance.taskId !== undefined &&
                (jobInstance as any).task?.owner?.id === user.id;
            const isProjectOwner = (jobInstance as any).project?.owner?.id === user.id;
            const canViewOriginal = isSuperuser || isTaskOwner || isProjectOwner;
            dispatch(masksActions.setCanViewOriginal(canViewOriginal));
        }
    }, [jobInstance, user]);

    useEffect(() => {
        if (jobInstance) {
            dispatch(fetchMaskRegionsAsync(jobInstance));
        }
    }, [jobInstance]);

    useEffect(() => {
        if (canvasReady) {
            canvasInstance.setupMaskRegions(getVisibleMasks());
        }
    }, [canvasReady, frameMaskRegions, viewOriginal, hiddenMasks]);

    useEffect(() => {
        if (canvasReady) {
            const onMaskRegionDrawn = (event: any): void => {
                if (event.detail && event.detail.points) {
                    const isTrack = activeMaskTypeRef.current === 'track';
                    dispatch(createMaskRegionAsync(event.detail.points, selectedColorRef.current, isTrack));
                }
            };

            const onMaskRegionUpdated = (event: any): void => {
                if (event.detail && event.detail.points) {
                    dispatch(updateMaskRegionAsync(event.detail.id, {
                        points: event.detail.points,
                        region: event.detail.region,
                    }));
                }
            };

            const onMaskRegionDeleted = (event: any): void => {
                if (event.detail && (event.detail.id || event.detail.region)) {
                    dispatch(deleteMaskRegionAsync(event.detail.id, event.detail.region));
                }
            };

            const onCanvasSetup = (): void => {
                canvasInstance.setupMaskRegions(getVisibleMasks());
            };

            const html = canvasInstance.html();
            html.addEventListener('canvas.maskregiondrawn', onMaskRegionDrawn);
            html.addEventListener('canvas.maskregionupdated', onMaskRegionUpdated);
            html.addEventListener('canvas.maskregiondeleted', onMaskRegionDeleted);
            html.addEventListener('canvas.setup', onCanvasSetup);

            return () => {
                html.removeEventListener('canvas.maskregiondrawn', onMaskRegionDrawn);
                html.removeEventListener('canvas.maskregionupdated', onMaskRegionUpdated);
                html.removeEventListener('canvas.maskregiondeleted', onMaskRegionDeleted);
                html.removeEventListener('canvas.setup', onCanvasSetup);
            };
        }
        return () => {};
    }, [canvasReady, canvasInstance, viewOriginal, frameMaskRegions, hiddenMasks]);

    return null;
}
