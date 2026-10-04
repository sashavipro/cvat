// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { CombinedState } from 'reducers';
import { changeFrameAsync } from 'actions/annotation-actions';
import {
    masksActions,
    deleteMaskTrackAsync,
    deleteMaskRegionAsync,
    setMaskKeyframeAsync,
    unsetMaskKeyframeAsync,
    toggleMaskOutsideAsync,
    updateMaskColorAsync,
} from 'actions/masks-actions';
import MaskItemComponent from './mask-item';

export default function MasksListSideBarComponent(): JSX.Element | null {
    const dispatch = useDispatch();

    const {
        maskRegions,
        frameMaskRegions,
        currentFrame,
        hiddenMasks,
    } = useSelector((state: CombinedState) => ({
        maskRegions: state.masks.maskRegions || [],
        frameMaskRegions: state.masks.frameMaskRegions || [],
        currentFrame: state.annotation.player.frame.number ?? state.masks.currentFrame ?? 0,
        hiddenMasks: state.masks.hiddenMasks || [],
    }));

    if (!maskRegions || maskRegions.length === 0) {
        return null;
    }

    const tracksMap = new Map<number, any[]>();
    const shapes: any[] = [];

    for (const region of maskRegions) {
        const tid = region.track_id ?? region.trackId;
        if (tid != null) {
            if (!tracksMap.has(tid)) {
                tracksMap.set(tid, []);
            }
            tracksMap.get(tid)!.push(region);
        } else if (region.frame === currentFrame) {
            shapes.push(region);
        }
    }

    const sortedTrackIds = Array.from(tracksMap.keys()).sort((a, b) => a - b).filter((tid) => {
        const keyframes = tracksMap.get(tid)!;
        keyframes.sort((a: any, b: any) => a.frame - b.frame);
        if (keyframes.length === 0 || currentFrame < keyframes[0].frame) {
            return false;
        }
        const currentKf = keyframes.find((k: any) => k.frame === currentFrame);
        if (currentKf) {
            return true;
        }
        let prevKf: any = null;
        for (const k of keyframes) {
            if (k.frame <= currentFrame) {
                prevKf = k;
            }
        }
        return prevKf && !prevKf.outside;
    });

    if (sortedTrackIds.length === 0 && shapes.length === 0) {
        return null;
    }

    return (
        <div className='cvat-objects-sidebar-privacy-masks-list'>
            {sortedTrackIds.map((tid) => {
                const keyframes = tracksMap.get(tid)!;
                const frameRegion = frameMaskRegions.find(
                    (r: any) => (r.track_id ?? r.trackId) === tid,
                );
                const color = keyframes[0]?.color || '#000000';
                const isHidden = hiddenMasks.includes(tid);

                const currentKf = keyframes.find((k: any) => k.frame === currentFrame);

                return (
                    <MaskItemComponent
                        key={`mask_track_${tid}`}
                        maskId={`track_${tid}`}
                        badge={`M${tid}`}
                        isTrack
                        color={color}
                        keyframes={keyframes}
                        currentFrame={currentFrame}
                        frameRegion={frameRegion}
                        isHidden={isHidden}
                        onToggleHidden={() => dispatch(masksActions.toggleHideMask(tid))}
                        onChangeColor={(newColor: string) => (
                            dispatch(updateMaskColorAsync({ trackId: tid }, newColor))
                        )}
                        onDelete={() => dispatch(deleteMaskTrackAsync(tid))}
                        onDeleteKeyframe={() => {
                            if (currentKf?.id) {
                                dispatch(unsetMaskKeyframeAsync(currentKf.id));
                            }
                        }}
                        onSetKeyframe={() => {
                            if (frameRegion?.points) {
                                dispatch(setMaskKeyframeAsync(tid, currentFrame, frameRegion.points, color));
                            }
                        }}
                        onToggleOutside={() => (
                            dispatch(toggleMaskOutsideAsync(tid, currentFrame, frameRegion || currentKf))
                        )}
                        onNavigateFrame={(frame: number) => dispatch(changeFrameAsync(frame))}
                    />
                );
            })}

            {shapes.map((shape) => {
                const isHidden = hiddenMasks.includes(`shape_${shape.id}`);
                const color = shape.color || '#000000';

                return (
                    <MaskItemComponent
                        key={`mask_shape_${shape.id}`}
                        maskId={`shape_${shape.id}`}
                        badge={`M${shape.id}`}
                        isTrack={false}
                        color={color}
                        keyframes={[shape]}
                        currentFrame={currentFrame}
                        frameRegion={shape.frame === currentFrame ? shape : null}
                        isHidden={isHidden}
                        onToggleHidden={() => dispatch(masksActions.toggleHideMask(`shape_${shape.id}`))}
                        onChangeColor={(newColor: string) => (
                            dispatch(updateMaskColorAsync({ shapeId: shape.id }, newColor))
                        )}
                        onDelete={() => dispatch(deleteMaskRegionAsync(shape.id))}
                        onNavigateFrame={(frame: number) => dispatch(changeFrameAsync(frame))}
                    />
                );
            })}
        </div>
    );
}
