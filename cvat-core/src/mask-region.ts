// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import User from './user';

export interface RawMaskRegionData {
    id?: number;
    job: number;
    frame: number;
    points: number[];
    z_order?: number;
    color?: string;
    track_id?: number | null;
    is_keyframe?: boolean;
    outside?: boolean;
    owner?: any;
    created_date?: string;
    updated_date?: string;
}

export default class FrameMaskRegion {
    public readonly id?: number;
    public readonly job: number;
    public readonly frame: number;
    public readonly owner?: User;
    public readonly createdDate?: string;
    public readonly updatedDate?: string;
    public points: number[];
    public zOrder: number;
    public color: string;
    public trackId?: number | null;
    public isKeyframe?: boolean;
    public outside?: boolean;

    constructor(initialData: RawMaskRegionData) {
        this.id = initialData.id;
        this.job = initialData.job;
        this.frame = initialData.frame;
        this.points = Array.isArray(initialData.points) ? [...initialData.points] : [];
        this.zOrder = typeof initialData.z_order === 'number' ? initialData.z_order : 0;
        this.color = initialData.color || '#000000';
        this.trackId = initialData.track_id;
        this.isKeyframe = typeof initialData.is_keyframe === 'boolean' ? initialData.is_keyframe : true;
        this.outside = typeof initialData.outside === 'boolean' ? initialData.outside : false;
        this.createdDate = initialData.created_date;
        this.updatedDate = initialData.updated_date;

        if (initialData.owner) {
            this.owner = initialData.owner instanceof User ? initialData.owner : new User(initialData.owner);
        }
    }

    public toJSON(): RawMaskRegionData {
        return {
            id: this.id,
            job: this.job,
            frame: this.frame,
            points: [...this.points],
            z_order: this.zOrder,
            color: this.color,
            track_id: this.trackId,
            is_keyframe: this.isKeyframe,
            outside: this.outside,
        };
    }
}
