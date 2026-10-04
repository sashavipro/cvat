// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React, { useState } from 'react';
import Icon from '@ant-design/icons';
import Popover from 'antd/lib/popover';
import { Row, Col } from 'antd/lib/grid';
import Button from 'antd/lib/button';
import Text from 'antd/lib/typography/Text';
import { useDispatch, useSelector } from 'react-redux';

import { Canvas, RectDrawingMethod } from 'cvat-canvas-wrapper';
import { RedactIcon } from 'icons';
import CVATTooltip from 'components/common/cvat-tooltip';
import ColorPicker from 'components/annotation-page/standard-workspace/objects-side-bar/color-picker';
import GlobalHotKeys from 'utils/mousetrap-react';
import { ShortcutScope } from 'utils/enums';
import { registerComponentShortcuts } from 'actions/shortcuts-actions';
import { subKeyMap } from 'utils/component-subkeymap';
import { updateActiveControl } from 'actions/annotation-actions';
import { masksActions, updateAllMaskRegionsColorAsync } from 'actions/masks-actions';
import { ActiveControl, CombinedState } from 'reducers';
import withVisibilityHandling from './handle-popover-visibility';

export interface Props {
    canvasInstance: Canvas;
    activeControl: ActiveControl;
    disabled?: boolean;
}

const componentShortcuts = {
    DRAW_PRIVACY_MASK: {
        name: 'Draw privacy blackout mask',
        description: 'Activate or deactivate drawing privacy blackout mask',
        sequences: ['b'],
        scope: ShortcutScope.STANDARD_WORKSPACE_CONTROLS,
    },
};

registerComponentShortcuts(componentShortcuts);

const QUICK_COLORS = [
    { name: 'Black', value: '#000000' },
    { name: 'White', value: '#ffffff' },
    { name: 'Dark Gray', value: '#333333' },
    { name: 'Red', value: '#ff4d4f' },
    { name: 'Blue', value: '#1890ff' },
];

const CustomPopover = withVisibilityHandling(Popover, 'draw-privacy-mask');

function RedactControl(props: Props): JSX.Element {
    const { canvasInstance, activeControl, disabled } = props;
    const dispatch = useDispatch();
    const isDrawing = activeControl === ActiveControl.REDACT;
    const [popoverOpen, setPopoverOpen] = useState(false);

    const { keyMap } = useSelector((state: CombinedState) => state.shortcuts);
    const normalizedKeyMap = useSelector((state: CombinedState) => state.shortcuts.normalizedKeyMap);
    const selectedColor = useSelector((state: CombinedState) => state.masks.selectedColor || '#000000');
    const activeMaskType = useSelector((state: CombinedState) => state.masks.activeMaskType || 'shape');
    const maskRegions = useSelector((state: CombinedState) => state.masks.maskRegions || []);

    const startDrawing = (type: 'shape' | 'track' = activeMaskType): void => {
        setPopoverOpen(false);
        dispatch(masksActions.setActiveMaskType(type));
        canvasInstance.cancel();
        dispatch(updateActiveControl(ActiveControl.REDACT));
        canvasInstance.draw({
            enabled: true,
            shapeType: 'mask_region',
            rectDrawingMethod: RectDrawingMethod.CLASSIC,
            crosshair: true,
        });
    };

    const stopDrawing = (): void => {
        canvasInstance.draw({ enabled: false });
        dispatch(updateActiveControl(ActiveControl.CURSOR));
    };

    const toggleDrawing = (): void => {
        if (isDrawing) {
            stopDrawing();
        } else {
            startDrawing(activeMaskType);
        }
    };

    const handlers: Record<keyof typeof componentShortcuts, (event?: KeyboardEvent) => void> = {
        DRAW_PRIVACY_MASK: (event: KeyboardEvent | undefined) => {
            if (event) event.preventDefault();
            toggleDrawing();
        },
    };

    const dynamicPopoverProps = isDrawing ? {
        overlayStyle: {
            display: 'none' as const,
        },
    } : {};

    const dynamicIconProps = isDrawing ? {
        className: 'cvat-draw-rectangle-control cvat-active-canvas-control',
        onClick: (): void => {
            stopDrawing();
        },
    } : {
        className: 'cvat-draw-rectangle-control',
    };

    const tooltipTitle = `Draw privacy blackout mask (${normalizedKeyMap.DRAW_PRIVACY_MASK || 'B'})`;

    const popoverContent = (
        <div className='cvat-draw-shape-popover-content' style={{ padding: '8px 12px', minWidth: '240px' }}>
            <Row justify='start' style={{ marginBottom: '8px' }}>
                <Col>
                    <Text className='cvat-text-color' strong>Draw privacy mask</Text>
                </Col>
            </Row>
            <Row justify='start' style={{ marginBottom: '6px' }}>
                <Col span={24}>
                    <Text className='cvat-text-color' style={{ fontSize: '12px' }}>Mask Color:</Text>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                        {QUICK_COLORS.map((c) => (
                            <div
                                key={c.value}
                                title={c.name}
                                onClick={(): void => {
                                    dispatch(masksActions.setSelectedColor(c.value));
                                }}
                                style={{
                                    width: '20px',
                                    height: '20px',
                                    borderRadius: '50%',
                                    backgroundColor: c.value,
                                    border: selectedColor.toLowerCase() === c.value.toLowerCase()
                                        ? '2px solid #1890ff'
                                        : '1px solid #d9d9d9',
                                    cursor: 'pointer',
                                    boxShadow: selectedColor.toLowerCase() === c.value.toLowerCase()
                                        ? '0 0 4px #1890ff'
                                        : 'none',
                                    flexShrink: 0,
                                }}
                            />
                        ))}
                        <ColorPicker
                            value={selectedColor}
                            resetVisible={false}
                            onChange={(color: string) => {
                                if (color) {
                                    dispatch(masksActions.setSelectedColor(color));
                                }
                            }}
                            placement='right'
                        >
                            <CVATTooltip title='Palette & Hex Color Picker'>
                                <div
                                    title='Choose custom color / enter hex'
                                    style={{
                                        width: '22px',
                                        height: '22px',
                                        borderRadius: '50%',
                                        background: 'conic-gradient(#ff0000, #ff7300, #fffb00, #48ff00, #00ffd5, #002bff, #7a00ff, #ff00c8, #ff0000)',
                                        cursor: 'pointer',
                                        boxShadow: '0 0 3px rgba(0, 0, 0, 0.4)',
                                        border: '2px solid #ffffff',
                                        flexShrink: 0,
                                    }}
                                />
                            </CVATTooltip>
                        </ColorPicker>
                        <div
                            style={{
                                marginLeft: 'auto',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                            }}
                        >
                            <div
                                style={{
                                    width: '16px',
                                    height: '16px',
                                    borderRadius: '3px',
                                    backgroundColor: selectedColor,
                                    border: '1px solid #d9d9d9',
                                }}
                            />
                            <Text type='secondary' style={{ fontSize: '11px', fontFamily: 'monospace' }}>
                                {selectedColor}
                            </Text>
                        </div>
                    </div>
                    {maskRegions.length > 0 && (
                        <div style={{ marginTop: '8px' }}>
                            <Button
                                size='small'
                                style={{ width: '100%', fontSize: '12px' }}
                                onClick={(): void => {
                                    dispatch(updateAllMaskRegionsColorAsync(selectedColor));
                                }}
                            >
                                {`Apply color to all (${maskRegions.length}) masks`}
                            </Button>
                        </div>
                    )}
                </Col>
            </Row>
            <Row justify='space-around' style={{ marginTop: '12px' }}>
                <Col span={24} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                    <CVATTooltip title={`Press ${normalizedKeyMap.DRAW_PRIVACY_MASK || 'B'} to draw again`}>
                        <Button
                            className='cvat-draw-mask-shape-button'
                            style={{ flex: 1 }}
                            type={activeMaskType === 'shape' ? 'primary' : 'default'}
                            onClick={(): void => {
                                startDrawing('shape');
                            }}
                        >
                            Shape
                        </Button>
                    </CVATTooltip>
                    <CVATTooltip title={`Press ${normalizedKeyMap.DRAW_PRIVACY_MASK || 'B'} to draw again`}>
                        <Button
                            className='cvat-draw-mask-track-button'
                            style={{ flex: 1 }}
                            type={activeMaskType === 'track' ? 'primary' : 'default'}
                            onClick={(): void => {
                                startDrawing('track');
                            }}
                        >
                            Track
                        </Button>
                    </CVATTooltip>
                </Col>
            </Row>
        </div>
    );

    return (
        <>
            <GlobalHotKeys
                keyMap={subKeyMap(componentShortcuts, keyMap)}
                handlers={handlers}
            />
            {disabled ? (
                <Icon className='cvat-draw-rectangle-control cvat-disabled-canvas-control' component={RedactIcon} />
            ) : (
                <CustomPopover
                    {...dynamicPopoverProps}
                    overlayClassName='cvat-draw-shape-popover'
                    placement='right'
                    content={popoverContent}
                    open={popoverOpen && !isDrawing}
                    onOpenChange={(visible: boolean) => {
                        if (!isDrawing) {
                            setPopoverOpen(visible);
                        }
                    }}
                >
                    <CVATTooltip title={tooltipTitle} placement='right'>
                        <Icon {...dynamicIconProps} component={RedactIcon} />
                    </CVATTooltip>
                </CustomPopover>
            )}
        </>
    );
}

Object.assign(RedactControl, { displayName: 'RedactControl' });
export default React.memo(RedactControl);
