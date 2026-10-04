// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React, { useState } from 'react';
import { Row, Col } from 'antd/lib/grid';
import Text from 'antd/lib/typography/Text';
import Dropdown from 'antd/lib/dropdown';
import Icon, {
    StarFilled,
    StarOutlined,
    EyeOutlined,
    EyeInvisibleFilled,
    MoreOutlined,
    DeleteOutlined,
    SelectOutlined,
} from '@ant-design/icons';

import CVATTooltip from 'components/common/cvat-tooltip';
import {
    FirstIcon,
    PreviousIcon,
    NextIcon,
    LastIcon,
    ObjectOutsideIcon,
} from 'icons';
import ColorPicker from './color-picker';

interface Props {
    maskId: number | string;
    badge: string;
    isTrack: boolean;
    color: string;
    keyframes: any[];
    currentFrame: number;
    frameRegion?: any | null;
    isHidden: boolean;
    onToggleHidden(): void;
    onChangeColor(newColor: string): void;
    onDelete(): void;
    onDeleteKeyframe?(): void;
    onSetKeyframe?(): void;
    onToggleOutside?(): void;
    onNavigateFrame(frame: number): void;
}

const disabledStyle: React.CSSProperties = { opacity: 0.5, pointerEvents: 'none' };

function getMaskRgbComponents(hex: string): string {
    const clean = (hex || '#000000').replace('#', '');
    if (clean === '000000' || clean === '000') {
        return '130, 130, 150';
    }
    const r = parseInt(clean.slice(0, 2), 16) || 0;
    const g = parseInt(clean.slice(2, 4), 16) || 0;
    const b = parseInt(clean.slice(4, 6), 16) || 0;
    return `${r}, ${g}, ${b}`;
}

function MaskItemComponent(props: Props): JSX.Element {
    const {
        maskId,
        badge,
        isTrack,
        color,
        keyframes,
        currentFrame,
        frameRegion,
        isHidden,
        onToggleHidden,
        onChangeColor,
        onDelete,
        onDeleteKeyframe,
        onSetKeyframe,
        onToggleOutside,
        onNavigateFrame,
    } = props;

    const [activated, setActivated] = useState(false);

    // Compute keyframe navigation for tracks
    const sortedKfs = [...keyframes].sort((a, b) => a.frame - b.frame);
    const firstFrame = sortedKfs.length > 0 ? sortedKfs[0].frame : null;
    const lastFrame = sortedKfs.length > 0 ? sortedKfs[sortedKfs.length - 1].frame : null;

    const prevKfs = sortedKfs.filter((k) => k.frame < currentFrame);
    const prevFrame = prevKfs.length > 0 ? prevKfs[prevKfs.length - 1].frame : null;

    const nextKfs = sortedKfs.filter((k) => k.frame > currentFrame);
    const nextFrame = nextKfs.length > 0 ? nextKfs[0].frame : null;

    const isCurrentKeyframe = sortedKfs.some((k) => k.frame === currentFrame);
    const isOutside = !!(frameRegion?.outside);
    const canSetKeyframe = frameRegion != null;

    const firstDisabled = firstFrame === null || firstFrame === currentFrame;
    const prevDisabled = prevFrame === null;
    const nextDisabled = nextFrame === null;
    const lastDisabled = lastFrame === null || lastFrame === currentFrame;

    const menuItems = [
        {
            key: 'delete',
            label: isTrack ? 'Delete track' : 'Delete mask',
            danger: true,
            icon: <DeleteOutlined />,
            onClick: onDelete,
        },
        ...(isTrack && isCurrentKeyframe && onDeleteKeyframe ? [{
            key: 'delete_kf',
            label: 'Delete keyframe',
            danger: true,
            onClick: onDeleteKeyframe,
        }] : []),
    ];

    return (
        <div style={{ display: 'flex', marginBottom: '1px' }}>
            <div
                id={`cvat-objects-sidebar-state-item-mask-${maskId}`}
                className={`cvat-objects-sidebar-state-item${activated ? ' cvat-objects-sidebar-state-active-item' : ''}`}
                style={{ '--state-item-background': getMaskRgbComponents(color) } as React.CSSProperties}
                onMouseEnter={() => setActivated(true)}
                onMouseLeave={() => setActivated(false)}
            >
                {/* Top Row: Badge, Type, Label/Color, 3-dots Menu */}
                <Row align='middle'>
                    <Col span={10}>
                        <Text style={{ fontSize: 12 }}>{badge}</Text>
                        <br />
                        <Text
                            type='secondary'
                            style={{ fontSize: 10 }}
                            className='cvat-objects-sidebar-state-item-object-type-text'
                        >
                            {isTrack ? 'RECTANGLE TRACK' : 'RECTANGLE SHAPE'}
                        </Text>
                    </Col>
                    <Col span={12}>
                        <ColorPicker
                            value={color}
                            onChange={onChangeColor}
                        >
                            <div
                                className='cvat-objects-sidebar-state-item-label-selector'
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    padding: '2px 8px',
                                    background: 'rgba(255, 255, 255, 0.82)',
                                    border: '1px solid rgba(0, 0, 0, 0.12)',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: 500,
                                    width: '100%',
                                }}
                            >
                                <span
                                    style={{
                                        display: 'inline-block',
                                        width: 10,
                                        height: 10,
                                        borderRadius: '50%',
                                        backgroundColor: color,
                                        marginRight: 6,
                                        boxShadow: '0 0 1px rgba(0,0,0,0.5)',
                                        flexShrink: 0,
                                    }}
                                />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    Privacy Mask
                                </span>
                            </div>
                        </ColorPicker>
                    </Col>
                    <Col span={2} style={{ textAlign: 'right' }}>
                        <Dropdown menu={{ items: menuItems }} trigger={['click']}>
                            <MoreOutlined style={{ fontSize: 18, cursor: 'pointer', color: 'rgba(0,0,0,0.62)' }} />
                        </Dropdown>
                    </Col>
                </Row>

                {/* Controls Row for Tracks */}
                {isTrack ? (
                    <Row align='middle' justify='space-around' style={{ marginTop: 4, paddingTop: 4, borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                        <Col span={20} style={{ textAlign: 'center' }}>
                            {/* Keyframe navigation: First, Prev, Next, Last */}
                            <Row justify='space-around'>
                                <Col>
                                    <CVATTooltip title='Go to first keyframe'>
                                        <Icon
                                            className='cvat-object-item-button-first-keyframe'
                                            component={FirstIcon}
                                            style={firstDisabled ? disabledStyle : undefined}
                                            onClick={firstDisabled ? undefined : () => onNavigateFrame(firstFrame!)}
                                        />
                                    </CVATTooltip>
                                </Col>
                                <Col>
                                    <CVATTooltip title='Go to previous keyframe'>
                                        <Icon
                                            className='cvat-object-item-button-prev-keyframe'
                                            component={PreviousIcon}
                                            style={prevDisabled ? disabledStyle : undefined}
                                            onClick={prevDisabled ? undefined : () => onNavigateFrame(prevFrame!)}
                                        />
                                    </CVATTooltip>
                                </Col>
                                <Col>
                                    <CVATTooltip title='Go to next keyframe'>
                                        <Icon
                                            className='cvat-object-item-button-next-keyframe'
                                            component={NextIcon}
                                            style={nextDisabled ? disabledStyle : undefined}
                                            onClick={nextDisabled ? undefined : () => onNavigateFrame(nextFrame!)}
                                        />
                                    </CVATTooltip>
                                </Col>
                                <Col>
                                    <CVATTooltip title='Go to last keyframe'>
                                        <Icon
                                            className='cvat-object-item-button-last-keyframe'
                                            component={LastIcon}
                                            style={lastDisabled ? disabledStyle : undefined}
                                            onClick={lastDisabled ? undefined : () => onNavigateFrame(lastFrame!)}
                                        />
                                    </CVATTooltip>
                                </Col>
                            </Row>

                            {/* Property switches: Outside, Hidden, Keyframe, Delete */}
                            <Row justify='space-around' style={{ marginTop: 4 }}>
                                <Col>
                                    <CVATTooltip title='Switch outside property'>
                                        {isOutside ? (
                                            <Icon
                                                className='cvat-object-item-button-outside cvat-object-item-button-outside-enabled'
                                                component={ObjectOutsideIcon}
                                                onClick={onToggleOutside}
                                            />
                                        ) : (
                                            <SelectOutlined
                                                className='cvat-object-item-button-outside'
                                                onClick={onToggleOutside}
                                            />
                                        )}
                                    </CVATTooltip>
                                </Col>
                                <Col>
                                    <CVATTooltip title='Switch hidden property'>
                                        {isHidden ? (
                                            <EyeInvisibleFilled
                                                className='cvat-object-item-button-hidden cvat-object-item-button-hidden-enabled'
                                                onClick={onToggleHidden}
                                            />
                                        ) : (
                                            <EyeOutlined
                                                className='cvat-object-item-button-hidden'
                                                onClick={onToggleHidden}
                                            />
                                        )}
                                    </CVATTooltip>
                                </Col>
                                <Col>
                                    <CVATTooltip title={isCurrentKeyframe ? 'Delete keyframe' : 'Set keyframe on current frame'}>
                                        {isCurrentKeyframe ? (
                                            <StarFilled
                                                className='cvat-object-item-button-keyframe cvat-object-item-button-keyframe-enabled'
                                                onClick={onDeleteKeyframe}
                                            />
                                        ) : (
                                            <StarOutlined
                                                className='cvat-object-item-button-keyframe'
                                                style={canSetKeyframe ? undefined : disabledStyle}
                                                onClick={canSetKeyframe ? onSetKeyframe : undefined}
                                            />
                                        )}
                                    </CVATTooltip>
                                </Col>
                                <Col>
                                    <CVATTooltip title='Delete track'>
                                        <DeleteOutlined
                                            style={{ color: 'rgba(0, 0, 0, 0.62)', cursor: 'pointer', fontSize: 14 }}
                                            onClick={onDelete}
                                        />
                                    </CVATTooltip>
                                </Col>
                            </Row>
                        </Col>
                    </Row>
                ) : (
                    /* Controls Row for Shapes */
                    <Row align='middle' justify='space-around' style={{ marginTop: 4, paddingTop: 4, borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                        <Col span={20} style={{ textAlign: 'center' }}>
                            <Row justify='space-around'>
                                <Col>
                                    <CVATTooltip title={`Go to frame ${keyframes[0]?.frame ?? 0}`}>
                                        <Text
                                            style={{ fontSize: 11, cursor: 'pointer', color: '#1890ff' }}
                                            onClick={() => onNavigateFrame(keyframes[0]?.frame ?? 0)}
                                        >
                                            Frame {keyframes[0]?.frame ?? 0}
                                        </Text>
                                    </CVATTooltip>
                                </Col>
                                <Col>
                                    <CVATTooltip title='Switch hidden property'>
                                        {isHidden ? (
                                            <EyeInvisibleFilled
                                                className='cvat-object-item-button-hidden cvat-object-item-button-hidden-enabled'
                                                onClick={onToggleHidden}
                                            />
                                        ) : (
                                            <EyeOutlined
                                                className='cvat-object-item-button-hidden'
                                                onClick={onToggleHidden}
                                            />
                                        )}
                                    </CVATTooltip>
                                </Col>
                                <Col>
                                    <CVATTooltip title='Delete mask'>
                                        <DeleteOutlined
                                            style={{ color: 'rgba(0, 0, 0, 0.62)', cursor: 'pointer', fontSize: 14 }}
                                            onClick={onDelete}
                                        />
                                    </CVATTooltip>
                                </Col>
                            </Row>
                        </Col>
                    </Row>
                )}
            </div>
        </div>
    );
}

export default React.memo(MaskItemComponent);
