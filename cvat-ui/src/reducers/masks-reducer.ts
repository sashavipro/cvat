// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import { AnnotationActionTypes } from 'actions/annotation-actions';
import { MasksActionTypes, MasksActions } from 'actions/masks-actions';
import { MasksState } from '.';

export function computeFrameMasks(maskRegions: any[], currentFrame: number): any[] {
    const shapes = maskRegions.filter(
        (region: any) => region.frame === currentFrame && region.track_id == null && region.trackId == null,
    );

    const tracksMap = new Map<number, any[]>();
    for (const region of maskRegions) {
        const tid = region.track_id ?? region.trackId;
        if (tid != null) {
            if (!tracksMap.has(tid)) {
                tracksMap.set(tid, []);
            }
            tracksMap.get(tid)!.push(region);
        }
    }

    const trackMasks: any[] = [];
    for (const [tid, keyframes] of tracksMap.entries()) {
        keyframes.sort((a, b) => a.frame - b.frame);
        if (keyframes.length === 0) continue;
        if (currentFrame < keyframes[0].frame) continue;

        const exactKf = keyframes.find((k) => k.frame === currentFrame);
        if (exactKf) {
            if (!exactKf.outside) {
                trackMasks.push({
                    ...exactKf,
                    track_id: tid,
                    is_keyframe: true,
                });
            }
            continue;
        }

        let prevKf: any = null;
        let nextKf: any = null;
        for (const k of keyframes) {
            if (k.frame < currentFrame) {
                prevKf = k;
            } else if (k.frame > currentFrame && !nextKf) {
                nextKf = k;
                break;
            }
        }

        if (prevKf && prevKf.outside) {
            continue;
        }

        if (prevKf && nextKf && prevKf.points?.length === 4 && nextKf.points?.length === 4) {
            const ratio = (currentFrame - prevKf.frame) / (nextKf.frame - prevKf.frame);
            const p1 = prevKf.points;
            const p2 = nextKf.points;
            const interpPoints = [
                p1[0] + (p2[0] - p1[0]) * ratio,
                p1[1] + (p2[1] - p1[1]) * ratio,
                p1[2] + (p2[2] - p1[2]) * ratio,
                p1[3] + (p2[3] - p1[3]) * ratio,
            ];
            trackMasks.push({
                id: prevKf.id,
                track_id: tid,
                frame: currentFrame,
                points: interpPoints,
                color: prevKf.color,
                is_keyframe: false,
                outside: false,
            });
        } else if (prevKf && !prevKf.outside) {
            trackMasks.push({
                id: prevKf.id,
                track_id: tid,
                frame: currentFrame,
                points: [...prevKf.points],
                color: prevKf.color,
                is_keyframe: false,
                outside: false,
            });
        }
    }

    return [...shapes, ...trackMasks];
}

const savedColor = typeof window !== 'undefined' ? localStorage.getItem('privacy_mask_color') : null;

const defaultState: MasksState = {
    maskRegions: [],
    frameMaskRegions: [],
    hiddenMasks: [],
    fetching: false,
    saving: false,
    viewOriginal: false,
    canViewOriginal: false,
    currentFrame: 0,
    selectedColor: savedColor || '#000000',
    activeMaskType: 'shape',
    error: null,
};

export default function (state: MasksState = defaultState, action: any): MasksState {
    switch (action.type) {
        case AnnotationActionTypes.GET_JOB_SUCCESS: {
            const currentFrame = action.payload.frameData?.number || 0;

            return {
                ...state,
                canViewOriginal: false,
                viewOriginal: false,
                currentFrame,
                maskRegions: [],
                frameMaskRegions: [],
                hiddenMasks: [],
            };
        }
        case AnnotationActionTypes.CHANGE_FRAME_SUCCESS: {
            const { number: frame } = action.payload;
            return {
                ...state,
                currentFrame: frame,
                frameMaskRegions: computeFrameMasks(state.maskRegions, frame),
            };
        }
        case MasksActionTypes.FETCH_MASK_REGIONS: {
            return {
                ...state,
                fetching: true,
                error: null,
            };
        }
        case MasksActionTypes.FETCH_MASK_REGIONS_SUCCESS: {
            const { maskRegions } = action.payload;
            return {
                ...state,
                fetching: false,
                maskRegions,
                frameMaskRegions: computeFrameMasks(maskRegions, state.currentFrame),
            };
        }
        case MasksActionTypes.FETCH_MASK_REGIONS_FAILED: {
            return {
                ...state,
                fetching: false,
                error: action.payload.error,
            };
        }
        case MasksActionTypes.CREATE_MASK_REGION: {
            return {
                ...state,
                saving: true,
                error: null,
            };
        }
        case MasksActionTypes.CREATE_MASK_REGION_SUCCESS: {
            const { maskRegion } = action.payload;
            const maskRegions = [...state.maskRegions, maskRegion];
            return {
                ...state,
                saving: false,
                maskRegions,
                frameMaskRegions: computeFrameMasks(maskRegions, state.currentFrame),
            };
        }
        case MasksActionTypes.CREATE_MASK_REGION_FAILED: {
            return {
                ...state,
                saving: false,
                error: action.payload.error,
            };
        }
        case MasksActionTypes.DELETE_MASK_REGION_SUCCESS: {
            const { id } = action.payload;
            const maskRegions = state.maskRegions.filter((region: any) => region.id !== id);
            return {
                ...state,
                maskRegions,
                frameMaskRegions: computeFrameMasks(maskRegions, state.currentFrame),
            };
        }
        case MasksActionTypes.UPDATE_MASK_REGION_SUCCESS: {
            const { maskRegion } = action.payload;
            const exists = state.maskRegions.some((r) => r.id === maskRegion.id);
            const maskRegions = exists
                ? state.maskRegions.map((region: any) => (region.id === maskRegion.id ? maskRegion : region))
                : [...state.maskRegions, maskRegion];
            return {
                ...state,
                maskRegions,
                frameMaskRegions: computeFrameMasks(maskRegions, state.currentFrame),
            };
        }
        case MasksActionTypes.SET_SELECTED_COLOR: {
            if (typeof window !== 'undefined') {
                try {
                    localStorage.setItem('privacy_mask_color', action.payload.selectedColor);
                } catch (_) {}
            }
            return {
                ...state,
                selectedColor: action.payload.selectedColor,
            };
        }
        case MasksActionTypes.SET_ACTIVE_MASK_TYPE: {
            return {
                ...state,
                activeMaskType: action.payload.activeMaskType,
            };
        }
        case MasksActionTypes.SWITCH_VIEW_ORIGINAL: {
            return {
                ...state,
                viewOriginal: action.payload.viewOriginal,
            };
        }
        case MasksActionTypes.SET_CAN_VIEW_ORIGINAL: {
            return {
                ...state,
                canViewOriginal: action.payload.canViewOriginal,
            };
        }
        case MasksActionTypes.TOGGLE_HIDE_MASK: {
            const { maskId } = action.payload;
            const hiddenMasks = state.hiddenMasks.includes(maskId)
                ? state.hiddenMasks.filter((id) => id !== maskId)
                : [...state.hiddenMasks, maskId];
            return {
                ...state,
                hiddenMasks,
            };
        }
        default:
            return state;
    }
}
