// Copyright (C) 2020-2022 Intel Corporation
// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import { ActionUnion, createAction, ThunkAction } from 'utils/redux';
import notification from 'antd/lib/notification';
import { getCore } from 'cvat-core-wrapper';
import { NewIssueSource } from 'reducers';

const cvat = getCore();

export enum ReviewActionTypes {
    FETCH_ISSUES = 'FETCH_ISSUES',
    FETCH_ISSUES_SUCCESS = 'FETCH_ISSUES_SUCCESS',
    FETCH_ISSUES_FAILED = 'FETCH_ISSUES_FAILED',
    CREATE_ISSUE = 'CREATE_ISSUE',
    START_ISSUE = 'START_ISSUE',
    FINISH_ISSUE_SUCCESS = 'FINISH_ISSUE_SUCCESS',
    FINISH_ISSUE_FAILED = 'FINISH_ISSUE_FAILED',
    CANCEL_ISSUE = 'CANCEL_ISSUE',
    RESOLVE_ISSUE = 'RESOLVE_ISSUE',
    RESOLVE_ISSUE_SUCCESS = 'RESOLVE_ISSUE_SUCCESS',
    RESOLVE_ISSUE_FAILED = 'RESOLVE_ISSUE_FAILED',
    REOPEN_ISSUE = 'REOPEN_ISSUE',
    REOPEN_ISSUE_SUCCESS = 'REOPEN_ISSUE_SUCCESS',
    REOPEN_ISSUE_FAILED = 'REOPEN_ISSUE_FAILED',
    COMMENT_ISSUE = 'COMMENT_ISSUE',
    COMMENT_ISSUE_SUCCESS = 'COMMENT_ISSUE_SUCCESS',
    COMMENT_ISSUE_FAILED = 'COMMENT_ISSUE_FAILED',
    REMOVE_ISSUE_SUCCESS = 'REMOVE_ISSUE_SUCCESS',
    REMOVE_ISSUE_FAILED = 'REMOVE_ISSUE_FAILED',
    SUBMIT_REVIEW = 'SUBMIT_REVIEW',
    SUBMIT_REVIEW_SUCCESS = 'SUBMIT_REVIEW_SUCCESS',
    SUBMIT_REVIEW_FAILED = 'SUBMIT_REVIEW_FAILED',
    SWITCH_ISSUES_HIDDEN_FLAG = 'SWITCH_ISSUES_HIDDEN_FLAG',
    SWITCH_RESOLVED_ISSUES_HIDDEN_FLAG = 'SWITCH_RESOLVED_ISSUES_HIDDEN_FLAG',
}

export const reviewActions = {
    createIssue: () => createAction(ReviewActionTypes.CREATE_ISSUE, {}),
    startIssue: (position: number[], source = NewIssueSource.ISSUE_TOOL) => (
        createAction(ReviewActionTypes.START_ISSUE, { position: cvat.classes.Issue.hull(position), source })
    ),
    finishIssueSuccess: (frame: number, issue: any) => (
        createAction(ReviewActionTypes.FINISH_ISSUE_SUCCESS, { frame, issue })
    ),
    finishIssueFailed: (error: any) => createAction(ReviewActionTypes.FINISH_ISSUE_FAILED, { error }),
    cancelIssue: () => createAction(ReviewActionTypes.CANCEL_ISSUE),
    commentIssue: (issueId: number) => createAction(ReviewActionTypes.COMMENT_ISSUE, { issueId }),
    commentIssueSuccess: () => createAction(ReviewActionTypes.COMMENT_ISSUE_SUCCESS),
    commentIssueFailed: (error: any) => createAction(ReviewActionTypes.COMMENT_ISSUE_FAILED, { error }),
    resolveIssue: (issueId: number) => createAction(ReviewActionTypes.RESOLVE_ISSUE, { issueId }),
    resolveIssueSuccess: () => createAction(ReviewActionTypes.RESOLVE_ISSUE_SUCCESS),
    resolveIssueFailed: (error: any) => createAction(ReviewActionTypes.RESOLVE_ISSUE_FAILED, { error }),
    reopenIssue: (issueId: number) => createAction(ReviewActionTypes.REOPEN_ISSUE, { issueId }),
    reopenIssueSuccess: () => createAction(ReviewActionTypes.REOPEN_ISSUE_SUCCESS),
    reopenIssueFailed: (error: any) => createAction(ReviewActionTypes.REOPEN_ISSUE_FAILED, { error }),
    submitReview: (jobId: number) => createAction(ReviewActionTypes.SUBMIT_REVIEW, { jobId }),
    submitReviewSuccess: () => createAction(ReviewActionTypes.SUBMIT_REVIEW_SUCCESS),
    submitReviewFailed: (error: any, jobId: number) => (
        createAction(ReviewActionTypes.SUBMIT_REVIEW_FAILED, { error, jobId })
    ),
    removeIssueSuccess: (issueId: number, frame: number) => (
        createAction(ReviewActionTypes.REMOVE_ISSUE_SUCCESS, { issueId, frame })
    ),
    removeIssueFailed: (error: any) => createAction(ReviewActionTypes.REMOVE_ISSUE_FAILED, { error }),
    switchIssuesHiddenFlag: (hidden: boolean) => createAction(ReviewActionTypes.SWITCH_ISSUES_HIDDEN_FLAG, { hidden }),
    switchIssuesHiddenResolvedFlag: (hidden: boolean) => (
        createAction(ReviewActionTypes.SWITCH_RESOLVED_ISSUES_HIDDEN_FLAG, { hidden })
    ),
    fetchIssues: () => createAction(ReviewActionTypes.FETCH_ISSUES),
    fetchIssuesSuccess: (issues: any[], frameIssues: any[]) => (
        createAction(ReviewActionTypes.FETCH_ISSUES_SUCCESS, { issues, frameIssues })
    ),
    fetchIssuesFailed: (error: any) => createAction(ReviewActionTypes.FETCH_ISSUES_FAILED, { error }),
};

export type ReviewActions = ActionUnion<typeof reviewActions>;

export const fetchIssuesAsync = (): ThunkAction => async (dispatch, getState) => {
    const state = getState();
    const { instance: jobInstance } = state.annotation.job;
    const { number: frame } = state.annotation.player.frame;
    if (!jobInstance) return;

    try {
        dispatch(reviewActions.fetchIssues());
        const issues = await jobInstance.issues();
        const frameIssues = issues.filter((issue: any): boolean => issue.frame === frame);
        dispatch(reviewActions.fetchIssuesSuccess(issues, frameIssues));
    } catch (error) {
        dispatch(reviewActions.fetchIssuesFailed(error));
        notification.error({
            message: 'Could not fetch issues',
            description: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

export const finishIssueAsync = (message: string): ThunkAction => async (dispatch, getState) => {
    const state = getState();
    const {
        annotation: {
            player: {
                frame: { number: frameNumber },
            },
            job: {
                instance: jobInstance,
            },
        },
        review: {
            newIssue: {
                position: newIssuePosition,
            },
        },
    } = state;

    try {
        const issue = new cvat.classes.Issue({
            job: jobInstance.id,
            frame: frameNumber,
            position: newIssuePosition,
        });

        const savedIssue = await jobInstance.openIssue(issue, message);
        dispatch(reviewActions.finishIssueSuccess(frameNumber, savedIssue));
    } catch (error) {
        dispatch(reviewActions.finishIssueFailed(error));
    }
};

export const commentIssueAsync = (id: number, message: string): ThunkAction => async (dispatch, getState) => {
    const state = getState();
    const {
        auth: { user },
        review: { frameIssues, issues },
    } = state;

    try {
        dispatch(reviewActions.commentIssue(id));
        const issue = frameIssues.find((_issue: any): boolean => _issue.id === id) ||
            issues.find((_issue: any): boolean => _issue.id === id);
        if (issue) {
            await issue.comment({
                message,
                owner: user,
            });
            dispatch(reviewActions.commentIssueSuccess());
        }
    } catch (error) {
        dispatch(reviewActions.commentIssueFailed(error));
    }
};

export const resolveIssueAsync = (id: number): ThunkAction => async (dispatch, getState) => {
    const state = getState();
    const {
        auth: { user },
        review: { frameIssues, issues },
    } = state;

    try {
        dispatch(reviewActions.resolveIssue(id));
        const issue = frameIssues.find((_issue: any): boolean => _issue.id === id) ||
            issues.find((_issue: any): boolean => _issue.id === id);
        if (issue) {
            await issue.resolve(user);
            dispatch(reviewActions.resolveIssueSuccess());
        }
    } catch (error) {
        dispatch(reviewActions.resolveIssueFailed(error));
    }
};

export const reopenIssueAsync = (id: number): ThunkAction => async (dispatch, getState) => {
    const state = getState();
    const {
        auth: { user },
        review: { frameIssues, issues },
    } = state;

    try {
        dispatch(reviewActions.reopenIssue(id));
        const issue = frameIssues.find((_issue: any): boolean => _issue.id === id) ||
            issues.find((_issue: any): boolean => _issue.id === id);
        if (issue) {
            await issue.reopen(user);
            dispatch(reviewActions.reopenIssueSuccess());
        }
    } catch (error) {
        dispatch(reviewActions.reopenIssueFailed(error));
    }
};

export const deleteIssueAsync = (id: number): ThunkAction => async (dispatch, getState) => {
    const state = getState();
    const {
        review: { frameIssues, issues },
        annotation: {
            player: {
                frame: { number: frameNumber },
            },
        },
    } = state;

    try {
        const issue = frameIssues.find((_issue: any): boolean => _issue.id === id) ||
            issues.find((_issue: any): boolean => _issue.id === id);
        if (issue) {
            await issue.delete();
            dispatch(reviewActions.removeIssueSuccess(id, issue.frame ?? frameNumber));
        }
    } catch (error) {
        dispatch(reviewActions.removeIssueFailed(error));
    }
};
