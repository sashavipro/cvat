// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

/// <reference types="cypress" />

context('Non-destructive frame masking', { scrollBehavior: false }, () => {
    const taskName = 'Frame masking test';
    const serverFiles = ['images/image_1.jpg'];

    let taskId = null;
    let jobId = null;

    before(() => {
        cy.visit('/auth/login');
        cy.login();
        cy.headlessCreateTask({
            labels: [{ name: 'test_label', attributes: [], type: 'rectangle' }],
            name: taskName,
            project_id: null,
            source_storage: { location: 'local' },
            target_storage: { location: 'local' },
        }, {
            server_files: serverFiles,
            image_quality: 70,
            use_zip_chunks: true,
            use_cache: true,
            sorting_method: 'lexicographical',
        }).then((response) => {
            taskId = response.taskID;
            [jobId] = response.jobIDs;
        });
    });

    after(() => {
        if (taskId) {
            cy.headlessDeleteTask(taskId);
        }
    });

    it('Check Redact control presence and drawing', () => {
        cy.visit(`/tasks/${taskId}/jobs/${jobId}`);
        cy.get('.cvat-canvas-container').should('exist');

        // Check the Redact icon exists in sidebar
        cy.get('.cvat-canvas-controls-sidebar').should('be.visible');
        cy.get('.cvat-canvas-controls-sidebar').within(() => {
            cy.get('span[aria-label="redact"]').should('exist');
        });

        // Activate Redact tool
        cy.get('span[aria-label="redact"]').click();

        // Draw a mask region on canvas
        cy.get('#cvat_canvas_wrapper').trigger('mousedown', 100, 100, { which: 1 });
        cy.get('#cvat_canvas_wrapper').trigger('mousemove', 250, 250);
        cy.get('#cvat_canvas_wrapper').trigger('mouseup', 250, 250, { which: 1 });

        // Confirm mask region appears in maskLayer
        cy.get('.cvat_canvas_mask_region').should('exist');

        // Check Original/Masked toggle button in top bar header
        cy.get('.cvat-annotation-header-right-group').within(() => {
            cy.contains('Original').should('exist');
        });
    });
});
