// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import './issues-review.scss';
import React, {
    useCallback, useEffect, useMemo, useRef,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import CVATTooltip from 'components/common/cvat-tooltip';
import { CombinedState } from 'reducers';
import { changeFrameAsync } from 'actions/annotation-actions';
import { fetchIssuesAsync, reviewActions } from 'actions/review-actions';

function getCommentAuthor(comment: any): string {
    if (!comment) return 'unknown';
    const owner = comment.owner;
    if (!owner) return 'unknown';
    return owner.username || owner.firstName || owner.first_name || 'unknown';
}

function getIssueOwner(issue: any): string {
    if (!issue) return 'unknown';
    const owner = issue.owner;
    if (!owner) return 'unknown';
    return owner.username || owner.firstName || owner.first_name || 'unknown';
}

function IssuesReviewComponent(): JSX.Element {
    const dispatch = useDispatch();
    const jobInstance = useSelector((state: CombinedState) => state.annotation.job.instance);
    const issues = useSelector((state: CombinedState) => state.review.issues);
    const fetching = useSelector((state: CombinedState) => state.review.fetching.jobId !== null);
    const currentFrame = useSelector((state: CombinedState) => state.annotation.player.frame.number);
    const issuesHidden = useSelector((state: CombinedState) => state.review.issuesHidden);
    const issuesResolvedHidden = useSelector((state: CombinedState) => state.review.issuesResolvedHidden);

    const activeCardRef = useRef<HTMLDivElement | null>(null);

    // Initial fetch if needed
    useEffect(() => {
        if (jobInstance && (!issues || issues.length === 0)) {
            dispatch(fetchIssuesAsync());
        }
    }, [jobInstance]);

    // Total counts
    const totalCount = issues.length;
    const openCount = useMemo(() => issues.filter((i: any) => !i.resolved).length, [issues]);
    const resolvedCount = useMemo(() => issues.filter((i: any) => !!i.resolved).length, [issues]);

    // Issues filtered and sorted
    const displayedIssues = useMemo(() => {
        let result = [...issues];
        if (issuesResolvedHidden) {
            result = result.filter((issue: any) => !issue.resolved);
        }
        return result.sort((a: any, b: any) => (a.frame - b.frame) || ((a.id ?? 0) - (b.id ?? 0)));
    }, [issues, issuesResolvedHidden]);

    // Unique frames with issues (from displayed issues)
    const framesWithIssues = useMemo(() => {
        const frameSet = new Set<number>();
        displayedIssues.forEach((i: any) => {
            if (typeof i.frame === 'number') {
                frameSet.add(i.frame);
            }
        });
        return Array.from(frameSet).sort((a, b) => a - b);
    }, [displayedIssues]);

    const prevFrame = useMemo(() => {
        const before = framesWithIssues.filter((f) => f < currentFrame);
        return before.length > 0 ? before[before.length - 1] : null;
    }, [framesWithIssues, currentFrame]);

    const nextFrame = useMemo(() => {
        const after = framesWithIssues.filter((f) => f > currentFrame);
        return after.length > 0 ? after[0] : null;
    }, [framesWithIssues, currentFrame]);

    // Matching issues on current frame
    const currentFrameIssues = useMemo(
        () => displayedIssues.filter((i: any) => i.frame === currentFrame),
        [displayedIssues, currentFrame],
    );

    // Scroll active card into view
    useEffect(() => {
        if (activeCardRef.current) {
            activeCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [currentFrame, displayedIssues]);

    const onCardClick = useCallback((frame: number) => {
        if (frame !== currentFrame) {
            dispatch(changeFrameAsync(frame));
        }
    }, [currentFrame, dispatch]);

    const onRefresh = useCallback(() => {
        dispatch(fetchIssuesAsync());
    }, [dispatch]);

    const toggleIssuesHidden = useCallback(() => {
        dispatch(reviewActions.switchIssuesHiddenFlag(!issuesHidden));
    }, [dispatch, issuesHidden]);

    const toggleIssuesResolvedHidden = useCallback(() => {
        dispatch(reviewActions.switchIssuesHiddenResolvedFlag(!issuesResolvedHidden));
    }, [dispatch, issuesResolvedHidden]);

    return (
        <div className='cvat-ir-panel' data-cvat-ir-panel='true'>
            <div className='cvat-ir-toolbar'>
                <div className='cvat-ir-toolbar-left'>
                    <span className='cvat-ir-toolbar-title'>Issues Review</span>
                    <span className='cvat-ir-count' data-cvat-ir-count='true'>
                        {`${totalCount} (`}
                        <span className='cvat-ir-count-open'>{openCount}</span>
                        {' / '}
                        <span className='cvat-ir-count-resolved'>{resolvedCount}</span>
                        {')'}
                    </span>
                </div>
                <button
                    type='button'
                    className='cvat-ir-refresh-btn'
                    disabled={fetching}
                    onClick={onRefresh}
                >
                    Refresh
                </button>
            </div>

            <div className='cvat-ir-toolbar-secondary'>
                <CVATTooltip title='Previous frame with an issue'>
                    <button
                        type='button'
                        className='cvat-ir-icon-btn'
                        disabled={prevFrame === null}
                        onClick={() => prevFrame !== null && dispatch(changeFrameAsync(prevFrame))}
                    >
                        {'‹'}
                    </button>
                </CVATTooltip>
                <CVATTooltip title='Next frame with an issue'>
                    <button
                        type='button'
                        className='cvat-ir-icon-btn'
                        disabled={nextFrame === null}
                        onClick={() => nextFrame !== null && dispatch(changeFrameAsync(nextFrame))}
                    >
                        {'›'}
                    </button>
                </CVATTooltip>

                <div className='cvat-ir-current-indicator' data-cvat-ir-current='true'>
                    {currentFrameIssues.length > 0 ? (
                        <span className='cvat-ir-current-badge' title={`Frame ${currentFrame}`}>
                            {`Issue ${currentFrameIssues.map((i: any) => `#${i.id}`).join(', ')}`}
                        </span>
                    ) : (
                        <span className='cvat-ir-current-none'>{`Frame ${currentFrame}`}</span>
                    )}
                </div>

                <CVATTooltip
                    title={
                        !issuesHidden ?
                            'Issues are shown on canvas (Click to hide)' :
                            'Issues are hidden from canvas (Click to show)'
                    }
                >
                    <button
                        type='button'
                        className={`cvat-ir-icon-btn ${!issuesHidden ? 'active-green' : 'inactive'}`}
                        data-cvat-ir-btn='eye'
                        onClick={toggleIssuesHidden}
                    >
                        {'👁'}
                    </button>
                </CVATTooltip>

                <CVATTooltip
                    title={
                        !issuesResolvedHidden ?
                            'Resolved issues are shown (Click to hide)' :
                            'Resolved issues are hidden (Click to show)'
                    }
                >
                    <button
                        type='button'
                        className={`cvat-ir-icon-btn ${!issuesResolvedHidden ? 'active-green' : 'inactive'}`}
                        data-cvat-ir-btn='resolved'
                        onClick={toggleIssuesResolvedHidden}
                    >
                        {'✓'}
                    </button>
                </CVATTooltip>
            </div>

            <div className='cvat-ir-list'>
                {fetching && displayedIssues.length === 0 ? (
                    <div className='cvat-ir-loading'>Loading issues…</div>
                ) : displayedIssues.length === 0 ? (
                    <div className='cvat-ir-empty'>No issues for this job.</div>
                ) : (
                    displayedIssues.map((issue: any) => {
                        const status = issue.resolved ? 'resolved' : 'open';
                        const isActive = issue.frame === currentFrame;
                        const comments = Array.isArray(issue.comments) ? issue.comments : [];
                        const firstComment = comments[0];
                        const lastComment = comments.length > 1 ? comments[comments.length - 1] : null;

                        return (
                            <div
                                key={issue.id}
                                ref={isActive ? activeCardRef : null}
                                className={`cvat-ir-card ${status} ${isActive ? 'active' : ''}`}
                                data-issue-id={String(issue.id)}
                                data-frame={String(issue.frame)}
                                onClick={() => onCardClick(issue.frame)}
                                onMouseEnter={() => {
                                    if (isActive) {
                                        const element = window.document.getElementById(
                                            `cvat_canvas_issue_region_${issue.id}`,
                                        );
                                        if (element) {
                                            element.setAttribute('fill', 'url(#cvat_issue_region_pattern_2)');
                                        }
                                    }
                                }}
                                onMouseLeave={() => {
                                    if (isActive) {
                                        const element = window.document.getElementById(
                                            `cvat_canvas_issue_region_${issue.id}`,
                                        );
                                        if (element) {
                                            element.setAttribute('fill', 'url(#cvat_issue_region_pattern_1)');
                                        }
                                    }
                                }}
                            >
                                <div className='cvat-ir-card-top'>
                                    <span className='cvat-ir-frame'>{`Frame ${issue.frame}`}</span>
                                    <span className={`cvat-ir-badge ${status}`}>{status}</span>
                                </div>
                                <div className='cvat-ir-meta'>
                                    {`Issue #${issue.id} · opened by ${getIssueOwner(issue)}`}
                                </div>
                                {firstComment && (
                                    <div className='cvat-ir-comment-block'>
                                        <div className='cvat-ir-comment-label'>
                                            {`First comment — ${getCommentAuthor(firstComment)}`}
                                        </div>
                                        <div className='cvat-ir-comment'>{firstComment.message || ''}</div>
                                    </div>
                                )}
                                {lastComment && (
                                    <div className='cvat-ir-comment-block'>
                                        <div className='cvat-ir-comment-label'>
                                            {`Last comment — ${getCommentAuthor(lastComment)}`}
                                        </div>
                                        <div className='cvat-ir-comment'>{lastComment.message || ''}</div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

export default React.memo(IssuesReviewComponent);
