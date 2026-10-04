// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import { ActionUnion, createAction, ThunkAction, ThunkDispatch } from 'utils/redux';
import { getCore, Job, HistoryActions } from 'cvat-core-wrapper';
import notification from 'antd/lib/notification';
import { ActiveControl, CombinedState } from 'reducers';
import { computeFrameMasks } from 'reducers/masks-reducer';
import { updateActiveControl, changeFrameAsync, AnnotationActionTypes } from './annotation-actions';

const cvat = getCore();

async function refreshMasksOnCanvas(dispatch: any, getState: () => CombinedState): Promise<void> {
    const state = getState();
    const currentFrame = state.annotation.player.frame.number ?? 0;
    const canvasInstance = state.annotation.canvas.instance;
    const hiddenMasks = state.masks.hiddenMasks || [];
    if (canvasInstance && typeof (canvasInstance as any).setupMaskRegions === 'function') {
        const frameMasks = computeFrameMasks(state.masks.maskRegions, currentFrame);
        const visibleMasks = frameMasks.filter((m: any) => {
            const isTrack = (m.track_id ?? m.trackId) != null;
            const maskKey = isTrack ? (m.track_id ?? m.trackId) : `shape_${m.id}`;
            return !hiddenMasks.includes(maskKey);
        });
        (canvasInstance as any).setupMaskRegions(visibleMasks);
    }
}

async function updateReduxHistory(dispatch: any, jobInstance: any, getState: () => CombinedState): Promise<void> {
    if (typeof (jobInstance.actions as any)?.get === 'function') {
        const history = await jobInstance.actions.get();
        dispatch({
            type: AnnotationActionTypes.FETCH_ANNOTATIONS_SUCCESS,
            payload: {
                states: getState().annotation.annotations.states,
                intervals: getState().annotation.annotations.intervals,
                history,
            },
        });
    }
}

export enum MasksActionTypes {
    FETCH_MASK_REGIONS = 'FETCH_MASK_REGIONS',
    FETCH_MASK_REGIONS_SUCCESS = 'FETCH_MASK_REGIONS_SUCCESS',
    FETCH_MASK_REGIONS_FAILED = 'FETCH_MASK_REGIONS_FAILED',
    CREATE_MASK_REGION = 'CREATE_MASK_REGION',
    CREATE_MASK_REGION_SUCCESS = 'CREATE_MASK_REGION_SUCCESS',
    CREATE_MASK_REGION_FAILED = 'CREATE_MASK_REGION_FAILED',
    UPDATE_MASK_REGION_SUCCESS = 'UPDATE_MASK_REGION_SUCCESS',
    DELETE_MASK_REGION = 'DELETE_MASK_REGION',
    DELETE_MASK_REGION_SUCCESS = 'DELETE_MASK_REGION_SUCCESS',
    DELETE_MASK_REGION_FAILED = 'DELETE_MASK_REGION_FAILED',
    SWITCH_VIEW_ORIGINAL = 'SWITCH_VIEW_ORIGINAL',
    SET_CAN_VIEW_ORIGINAL = 'SET_CAN_VIEW_ORIGINAL',
    SET_SELECTED_COLOR = 'SET_SELECTED_COLOR',
    SET_ACTIVE_MASK_TYPE = 'SET_ACTIVE_MASK_TYPE',
    TOGGLE_HIDE_MASK = 'TOGGLE_HIDE_MASK',
}

export const masksActions = {
    fetchMaskRegions: () => createAction(MasksActionTypes.FETCH_MASK_REGIONS),
    fetchMaskRegionsSuccess: (maskRegions: any[]) => (
        createAction(MasksActionTypes.FETCH_MASK_REGIONS_SUCCESS, { maskRegions })
    ),
    fetchMaskRegionsFailed: (error: any) => createAction(MasksActionTypes.FETCH_MASK_REGIONS_FAILED, { error }),

    createMaskRegion: () => createAction(MasksActionTypes.CREATE_MASK_REGION),
    createMaskRegionSuccess: (maskRegion: any) => (
        createAction(MasksActionTypes.CREATE_MASK_REGION_SUCCESS, { maskRegion })
    ),
    createMaskRegionFailed: (error: any) => createAction(MasksActionTypes.CREATE_MASK_REGION_FAILED, { error }),

    updateMaskRegionSuccess: (maskRegion: any) => (
        createAction(MasksActionTypes.UPDATE_MASK_REGION_SUCCESS, { maskRegion })
    ),

    deleteMaskRegion: (id: number) => createAction(MasksActionTypes.DELETE_MASK_REGION, { id }),
    deleteMaskRegionSuccess: (id: number) => createAction(MasksActionTypes.DELETE_MASK_REGION_SUCCESS, { id }),
    deleteMaskRegionFailed: (error: any) => createAction(MasksActionTypes.DELETE_MASK_REGION_FAILED, { error }),

    switchViewOriginal: (viewOriginal: boolean) => (
        createAction(MasksActionTypes.SWITCH_VIEW_ORIGINAL, { viewOriginal })
    ),
    setCanViewOriginal: (canViewOriginal: boolean) => (
        createAction(MasksActionTypes.SET_CAN_VIEW_ORIGINAL, { canViewOriginal })
    ),
    setSelectedColor: (selectedColor: string) => (
        createAction(MasksActionTypes.SET_SELECTED_COLOR, { selectedColor })
    ),
    setActiveMaskType: (activeMaskType: 'shape' | 'track') => (
        createAction(MasksActionTypes.SET_ACTIVE_MASK_TYPE, { activeMaskType })
    ),
    toggleHideMask: (maskId: number | string) => (
        createAction(MasksActionTypes.TOGGLE_HIDE_MASK, { maskId })
    ),
};

export type MasksActions = ActionUnion<typeof masksActions>;

export function fetchMaskRegionsAsync(jobInstance: Job): ThunkAction {
    return async (dispatch): Promise<void> => {
        dispatch(masksActions.fetchMaskRegions());
        try {
            const maskRegions = await jobInstance.maskRegions.get();
            dispatch(masksActions.fetchMaskRegionsSuccess(maskRegions));
        } catch (error: any) {
            dispatch(masksActions.fetchMaskRegionsFailed(error));
        }
    };
}

export function createMaskRegionAsync(points: number[], color?: string, isTrack?: boolean): ThunkAction {
    return async (dispatch: ThunkDispatch, getState): Promise<void> => {
        const state: CombinedState = getState();
        const jobInstance = state.annotation.job.instance;
        const frameNumber = state.annotation.player.frame.number ?? state.masks.currentFrame ?? 0;
        const maskColor = color || state.masks.selectedColor || '#000000';
        const isTrackValue = typeof isTrack === 'boolean' ? isTrack : (state.masks.activeMaskType === 'track');
        let trackId: number | null = null;
        if (isTrackValue) {
            const existingTrackIds = state.masks.maskRegions
                .map((r: any) => r.track_id ?? r.trackId)
                .filter((id: any) => typeof id === 'number' && !Number.isNaN(id));
            const maxTrackId = existingTrackIds.length > 0 ? Math.max(...existingTrackIds) : 0;
            trackId = maxTrackId + 1;
        }

        if (!jobInstance) return;

        dispatch(masksActions.createMaskRegion());
        try {
            const newRegion = await jobInstance.maskRegions.save({
                job: jobInstance.id,
                frame: frameNumber,
                points,
                color: maskColor,
                z_order: 0,
                track_id: trackId,
                is_keyframe: true,
                outside: false,
            });

            dispatch(masksActions.createMaskRegionSuccess(newRegion));

            dispatch(updateActiveControl(ActiveControl.CURSOR));
            notification.success({
                message: isTrackValue ? 'Mask track created' : 'Mask shape created',
                description: `A privacy mask ${isTrackValue ? 'track' : 'shape'} has been created for frame ${frameNumber}`,
            });

            if (typeof (jobInstance.actions as any)?.do === 'function') {
                let currentId = newRegion.id;
                const undo = async (): Promise<void> => {
                    await jobInstance.maskRegions.delete(currentId);
                    dispatch(masksActions.deleteMaskRegionSuccess(currentId));
                    await refreshMasksOnCanvas(dispatch, getState);
                };
                const redo = async (): Promise<void> => {
                    const recreated = await jobInstance.maskRegions.save({
                        job: jobInstance.id,
                        frame: newRegion.frame,
                        points: newRegion.points,
                        color: newRegion.color,
                        z_order: newRegion.z_order ?? 0,
                        track_id: newRegion.track_id ?? null,
                        is_keyframe: newRegion.is_keyframe ?? true,
                        outside: newRegion.outside ?? false,
                    });
                    currentId = recreated.id;
                    dispatch(masksActions.createMaskRegionSuccess(recreated));
                    await refreshMasksOnCanvas(dispatch, getState);
                };
                (jobInstance.actions as any).do(
                    HistoryActions.CREATED_OBJECTS,
                    undo,
                    redo,
                    [newRegion.id],
                    frameNumber,
                );
                await updateReduxHistory(dispatch, jobInstance, getState);
            }
        } catch (error: any) {
            dispatch(masksActions.createMaskRegionFailed(error));
            notification.error({
                message: 'Could not create mask region',
                description: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    };
}

export function updateMaskRegionAsync(
    regionId: number,
    data: { points?: number[]; color?: string; region?: any },
): ThunkAction {
    return async (dispatch, getState): Promise<void> => {
        const state: CombinedState = getState();
        const jobInstance = state.annotation.job.instance;
        const frameNumber = state.annotation.player.frame.number ?? state.masks.currentFrame ?? 0;

        if (!jobInstance) return;

        try {
            const targetRegion = data.region;
            const tid = targetRegion?.track_id ?? targetRegion?.trackId;

            // If updating an interpolated track frame, create a new keyframe for this frame
            if (tid != null && (!targetRegion.is_keyframe && !targetRegion.isKeyframe)) {
                const newKeyframe = await jobInstance.maskRegions.save({
                    job: jobInstance.id,
                    frame: frameNumber,
                    points: data.points || targetRegion.points,
                    color: data.color || targetRegion.color || state.masks.selectedColor || '#000000',
                    z_order: 0,
                    track_id: tid,
                    is_keyframe: true,
                    outside: false,
                });
                dispatch(masksActions.updateMaskRegionSuccess(newKeyframe));
                notification.success({
                    message: 'Keyframe created',
                    description: `Created keyframe for mask track on frame ${frameNumber}`,
                });
                return;
            }

            const updatedRegion = await jobInstance.maskRegions.update(regionId, {
                points: data.points,
                color: data.color,
            });
            dispatch(masksActions.updateMaskRegionSuccess(updatedRegion));
        } catch (error: any) {
            notification.error({
                message: 'Could not update mask region',
                description: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    };
}

export function updateAllMaskRegionsColorAsync(color: string): ThunkAction {
    return async (dispatch: ThunkDispatch, getState): Promise<void> => {
        const state: CombinedState = getState();
        const jobInstance = state.annotation.job.instance;
        const maskRegions = state.masks.maskRegions;

        dispatch(masksActions.setSelectedColor(color));

        if (!jobInstance || !maskRegions || maskRegions.length === 0) return;

        try {
            const updatePromises = maskRegions
                .filter((r: any) => r.id != null)
                .map((r: any) => jobInstance.maskRegions.update(r.id, { color }));
            await Promise.all(updatePromises);

            const updatedRegions = await jobInstance.maskRegions.get();
            dispatch(masksActions.fetchMaskRegionsSuccess(updatedRegions));

            notification.success({
                message: 'Masks color updated',
                description: `Updated color to ${color} for all ${maskRegions.length} privacy masks.`,
            });
        } catch (error: any) {
            notification.error({
                message: 'Failed to update mask colors',
                description: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    };
}

export function deleteMaskRegionAsync(regionId: number, region?: any): ThunkAction {
    return async (dispatch, getState): Promise<void> => {
        const state: CombinedState = getState();
        const jobInstance = state.annotation.job.instance;
        const frameNumber = state.annotation.player.frame.number ?? state.masks.currentFrame ?? 0;

        if (!jobInstance) return;

        const targetRegion = region || state.masks.maskRegions.find((r: any) => r.id === regionId);
        const deletedRegionData = targetRegion ? { ...targetRegion } : null;

        dispatch(masksActions.deleteMaskRegion(regionId));
        try {
            const tid = region?.track_id ?? region?.trackId;
            if (tid != null && (!region.is_keyframe && !region.isKeyframe)) {
                // If deleting on an interpolated frame, mark track as outside from this frame
                const outsideKf = await jobInstance.maskRegions.save({
                    job: jobInstance.id,
                    frame: frameNumber,
                    points: region.points,
                    color: region.color || '#000000',
                    z_order: 0,
                    track_id: tid,
                    is_keyframe: true,
                    outside: true,
                });
                dispatch(masksActions.createMaskRegionSuccess(outsideKf));

                if (typeof (jobInstance.actions as any)?.do === 'function') {
                    let outsideId = outsideKf.id;
                    const undo = async (): Promise<void> => {
                        await jobInstance.maskRegions.delete(outsideId);
                        dispatch(masksActions.deleteMaskRegionSuccess(outsideId));
                        await refreshMasksOnCanvas(dispatch, getState);
                    };
                    const redo = async (): Promise<void> => {
                        const recreated = await jobInstance.maskRegions.save({
                            job: jobInstance.id,
                            frame: frameNumber,
                            points: region.points,
                            color: region.color || '#000000',
                            z_order: 0,
                            track_id: tid,
                            is_keyframe: true,
                            outside: true,
                        });
                        outsideId = recreated.id;
                        dispatch(masksActions.createMaskRegionSuccess(recreated));
                        await refreshMasksOnCanvas(dispatch, getState);
                    };
                    (jobInstance.actions as any).do(
                        HistoryActions.REMOVED_OBJECT,
                        undo,
                        redo,
                        [outsideKf.id],
                        frameNumber,
                    );
                    await updateReduxHistory(dispatch, jobInstance, getState);
                }

                notification.success({
                    message: 'Mask track hidden',
                    description: `Mask track is outside from frame ${frameNumber} onward`,
                });
                return;
            }

            await jobInstance.maskRegions.delete(regionId);
            dispatch(masksActions.deleteMaskRegionSuccess(regionId));

            if (deletedRegionData && typeof (jobInstance.actions as any)?.do === 'function') {
                let restoredId: number | null = null;
                const undo = async (): Promise<void> => {
                    const restored = await jobInstance.maskRegions.save({
                        job: jobInstance.id,
                        frame: deletedRegionData.frame,
                        points: deletedRegionData.points,
                        color: deletedRegionData.color || '#000000',
                        z_order: deletedRegionData.z_order ?? 0,
                        track_id: deletedRegionData.track_id ?? deletedRegionData.trackId ?? null,
                        is_keyframe: deletedRegionData.is_keyframe ?? true,
                        outside: deletedRegionData.outside ?? false,
                    });
                    restoredId = restored.id;
                    dispatch(masksActions.createMaskRegionSuccess(restored));
                    await refreshMasksOnCanvas(dispatch, getState);
                };
                const redo = async (): Promise<void> => {
                    const id = restoredId ?? regionId;
                    await jobInstance.maskRegions.delete(id);
                    dispatch(masksActions.deleteMaskRegionSuccess(id));
                    await refreshMasksOnCanvas(dispatch, getState);
                };
                (jobInstance.actions as any).do(
                    HistoryActions.REMOVED_OBJECT,
                    undo,
                    redo,
                    [regionId],
                    deletedRegionData.frame ?? frameNumber,
                );
                await updateReduxHistory(dispatch, jobInstance, getState);
            }

            notification.success({
                message: 'Mask region deleted',
            });
        } catch (error: any) {
            dispatch(masksActions.deleteMaskRegionFailed(error));
            notification.error({
                message: 'Could not delete mask region',
                description: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    };
}

export function toggleViewOriginalAsync(): ThunkAction {
    return async (dispatch, getState): Promise<void> => {
        const state: CombinedState = getState();
        const currentViewOriginal = state.masks.viewOriginal;
        const newViewOriginal = !currentViewOriginal;
        const { instance: canvasInstance } = state.annotation.canvas;
        const { data: frameData } = state.annotation.player.frame;
        const { frameMaskRegions } = state.masks;

        dispatch(masksActions.switchViewOriginal(newViewOriginal));

        if (canvasInstance && frameData) {
            try {
                const renderResult = await frameData.data({ original: newViewOriginal });
                if (renderResult && typeof (canvasInstance as any).updateImage === 'function') {
                    (canvasInstance as any).updateImage(renderResult);
                }
                if (typeof (canvasInstance as any).setupMaskRegions === 'function') {
                    (canvasInstance as any).setupMaskRegions(newViewOriginal ? [] : frameMaskRegions);
                }
            } catch (error: any) {
                notification.error({
                    message: 'Could not fetch original frame',
                    description: error instanceof Error ? error.message : 'Access denied or error',
                });
                dispatch(masksActions.switchViewOriginal(currentViewOriginal));
            }
        }
    };
}

export function deleteMaskTrackAsync(trackId: number): ThunkAction {
    return async (dispatch: ThunkDispatch, getState): Promise<void> => {
        const state: CombinedState = getState();
        const jobInstance = state.annotation.job.instance;
        const frameNumber = state.annotation.player.frame.number ?? state.masks.currentFrame ?? 0;
        if (!jobInstance) return;

        const trackRegions = [...state.masks.maskRegions.filter(
            (r: any) => (r.track_id ?? r.trackId) === trackId,
        )];

        try {
            await Promise.all(trackRegions.map((kf: any) => jobInstance.maskRegions.delete(kf.id)));
            trackRegions.forEach((kf: any) => dispatch(masksActions.deleteMaskRegionSuccess(kf.id)));

            if (trackRegions.length > 0 && typeof (jobInstance.actions as any)?.do === 'function') {
                let restoredRegions: any[] = [];
                const undo = async (): Promise<void> => {
                    restoredRegions = [];
                    for (const kf of trackRegions) {
                        const restored = await jobInstance.maskRegions.save({
                            job: jobInstance.id,
                            frame: kf.frame,
                            points: kf.points,
                            color: kf.color || '#000000',
                            z_order: kf.z_order ?? 0,
                            track_id: trackId,
                            is_keyframe: kf.is_keyframe ?? true,
                            outside: kf.outside ?? false,
                        });
                        restoredRegions.push(restored);
                        dispatch(masksActions.createMaskRegionSuccess(restored));
                    }
                    await refreshMasksOnCanvas(dispatch, getState);
                };
                const redo = async (): Promise<void> => {
                    const targets = restoredRegions.length > 0 ? restoredRegions : trackRegions;
                    await Promise.all(targets.map((kf: any) => jobInstance.maskRegions.delete(kf.id)));
                    targets.forEach((kf: any) => dispatch(masksActions.deleteMaskRegionSuccess(kf.id)));
                    await refreshMasksOnCanvas(dispatch, getState);
                };
                (jobInstance.actions as any).do(
                    HistoryActions.REMOVED_OBJECT,
                    undo,
                    redo,
                    trackRegions.map((kf: any) => kf.id),
                    trackRegions[0]?.frame ?? frameNumber,
                );
                await updateReduxHistory(dispatch, jobInstance, getState);
            }

            notification.success({
                message: 'Mask track deleted',
                description: `Deleted mask track #${trackId}`,
            });
        } catch (error: any) {
            notification.error({
                message: 'Could not delete mask track',
                description: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    };
}

export function setMaskKeyframeAsync(
    trackId: number,
    frame: number,
    points: number[],
    color?: string,
): ThunkAction {
    return async (dispatch: ThunkDispatch, getState): Promise<void> => {
        const state: CombinedState = getState();
        const jobInstance = state.annotation.job.instance;
        if (!jobInstance) return;

        const maskColor = color || state.masks.selectedColor || '#000000';

        try {
            const newKeyframe = await jobInstance.maskRegions.save({
                job: jobInstance.id,
                frame,
                points,
                color: maskColor,
                z_order: 0,
                track_id: trackId,
                is_keyframe: true,
                outside: false,
            });
            dispatch(masksActions.createMaskRegionSuccess(newKeyframe));
            notification.success({
                message: 'Keyframe added',
                description: `Created keyframe for mask track #${trackId} at frame ${frame}`,
            });
        } catch (error: any) {
            notification.error({
                message: 'Could not set keyframe',
                description: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    };
}

export function unsetMaskKeyframeAsync(keyframeId: number): ThunkAction {
    return async (dispatch: ThunkDispatch, getState): Promise<void> => {
        const state: CombinedState = getState();
        const jobInstance = state.annotation.job.instance;
        if (!jobInstance) return;

        const kf = state.masks.maskRegions.find((r: any) => r.id === keyframeId);
        const kfData = kf ? { ...kf } : null;

        try {
            await jobInstance.maskRegions.delete(keyframeId);
            dispatch(masksActions.deleteMaskRegionSuccess(keyframeId));

            if (kfData && typeof (jobInstance.actions as any)?.do === 'function') {
                let currentId: number | null = null;
                const undo = async (): Promise<void> => {
                    const restored = await jobInstance.maskRegions.save({
                        job: jobInstance.id,
                        frame: kfData.frame,
                        points: kfData.points,
                        color: kfData.color || '#000000',
                        z_order: kfData.z_order ?? 0,
                        track_id: kfData.track_id ?? kfData.trackId,
                        is_keyframe: true,
                        outside: kfData.outside ?? false,
                    });
                    currentId = restored.id;
                    dispatch(masksActions.createMaskRegionSuccess(restored));
                    await refreshMasksOnCanvas(dispatch, getState);
                };
                const redo = async (): Promise<void> => {
                    const id = currentId ?? keyframeId;
                    await jobInstance.maskRegions.delete(id);
                    dispatch(masksActions.deleteMaskRegionSuccess(id));
                    await refreshMasksOnCanvas(dispatch, getState);
                };
                (jobInstance.actions as any).do(
                    HistoryActions.REMOVED_OBJECT,
                    undo,
                    redo,
                    [keyframeId],
                    kfData.frame,
                );
                await updateReduxHistory(dispatch, jobInstance, getState);
            }

            notification.success({
                message: 'Keyframe removed',
            });
        } catch (error: any) {
            notification.error({
                message: 'Could not remove keyframe',
                description: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    };
}

export function toggleMaskOutsideAsync(trackId: number, frame: number, region: any): ThunkAction {
    return async (dispatch: ThunkDispatch, getState): Promise<void> => {
        const state: CombinedState = getState();
        const jobInstance = state.annotation.job.instance;
        if (!jobInstance) return;

        try {
            const isKf = region?.is_keyframe ?? region?.isKeyframe;
            if (isKf && region?.id) {
                const newOutside = !region.outside;
                const updated = await jobInstance.maskRegions.update(region.id, {
                    outside: newOutside,
                });
                dispatch(masksActions.updateMaskRegionSuccess(updated));
                notification.success({
                    message: newOutside ? 'Mask marked as outside' : 'Mask marked as inside',
                });
            } else if (region?.points) {
                // Interpolated frame: create a keyframe with toggled outside
                const newOutside = !region.outside;
                const newKf = await jobInstance.maskRegions.save({
                    job: jobInstance.id,
                    frame,
                    points: region.points,
                    color: region.color || state.masks.selectedColor || '#000000',
                    z_order: 0,
                    track_id: trackId,
                    is_keyframe: true,
                    outside: newOutside,
                });
                dispatch(masksActions.createMaskRegionSuccess(newKf));
                notification.success({
                    message: newOutside ? 'Mask marked as outside' : 'Mask marked as inside',
                });
            }
        } catch (error: any) {
            notification.error({
                message: 'Could not update outside property',
                description: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    };
}

export function updateMaskColorAsync(
    target: { trackId?: number; shapeId?: number },
    color: string,
): ThunkAction {
    return async (dispatch: ThunkDispatch, getState): Promise<void> => {
        const state: CombinedState = getState();
        const jobInstance = state.annotation.job.instance;
        if (!jobInstance) return;

        try {
            if (target.trackId != null) {
                const trackKfs = state.masks.maskRegions.filter(
                    (r: any) => (r.track_id ?? r.trackId) === target.trackId,
                );
                await Promise.all(trackKfs.map((kf: any) => jobInstance.maskRegions.update(kf.id, { color })));
            } else if (target.shapeId != null) {
                await jobInstance.maskRegions.update(target.shapeId, { color });
            }
            const updatedRegions = await jobInstance.maskRegions.get();
            dispatch(masksActions.fetchMaskRegionsSuccess(updatedRegions));
            notification.success({
                message: 'Mask color updated',
            });
        } catch (error: any) {
            notification.error({
                message: 'Could not update mask color',
                description: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    };
}
