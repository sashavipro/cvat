package masks

import rego.v1

import data.utils
import data.organizations

# input: {
#     "scope": <"create"|"create@job"|"view"|"list"|"update"|"delete"|"view_original"> or null,
#     "auth": {
#         "user": {
#             "id": <num>,
#             "privilege": <"admin"|"user"|"worker"> or null
#         },
#         "organization": {
#             "id": <num>,
#             "owner": {
#                 "id": <num>
#             },
#             "user": {
#                 "role": <"owner"|"maintainer"|"supervisor"|"worker"> or null
#             }
#         } or null,
#     },
#     "resource": {
#         "id": <num>,
#         "owner": { "id": <num> },
#         "project": {
#             "owner": { "id": <num> },
#             "assignee": { "id": <num> }
#         } or null,
#         "task": {
#             "owner": { "id": <num> },
#             "assignee": { "id": <num> }
#         },
#         "job": {
#             "assignee": { "id": <num> }
#         },
#         "organization": { "id": <num> } or null
#     }
# }

is_mask_owner if {
    input.resource.owner.id == input.auth.user.id
}

is_job_assignee if {
    input.resource.job.assignee.id == input.auth.user.id
}

is_task_owner if {
    input.resource.task.owner.id == input.auth.user.id
}

is_task_assignee if {
    input.resource.task.assignee.id == input.auth.user.id
}

is_project_owner if {
    input.resource.project.owner.id == input.auth.user.id
}

is_project_assignee if {
    input.resource.project.assignee.id == input.auth.user.id
}

is_project_staff if {
    is_project_owner
}

is_project_staff if {
    is_project_assignee
}

is_task_staff if {
    is_project_staff
}

is_task_staff if {
    is_task_owner
}

is_task_staff if {
    is_task_assignee
}

is_job_staff if {
    is_task_staff
}

is_job_staff if {
    is_job_assignee
}

is_mask_admin if {
    is_task_staff
}

is_mask_admin if {
    is_mask_owner
}

is_mask_staff if {
    is_job_staff
}

is_mask_staff if {
    is_mask_admin
}

default allow := false

allow if {
    utils.is_admin
}

allow if {
    input.scope == utils.CREATE_IN_JOB
    utils.is_sandbox
    utils.has_perm(utils.WORKER)
    is_job_staff
}

allow if {
    input.scope == utils.CREATE_IN_JOB
    input.auth.organization.id == input.resource.organization.id
    utils.is_organization
    utils.has_perm(utils.USER)
    organizations.has_perm(organizations.MAINTAINER)
}

allow if {
    input.scope == utils.CREATE_IN_JOB
    input.auth.organization.id == input.resource.organization.id
    utils.is_organization
    utils.has_perm(utils.WORKER)
    organizations.is_member
    is_job_staff
}

allow if {
    input.scope == utils.LIST
    utils.is_sandbox
}

allow if {
    input.scope == utils.LIST
    organizations.is_member
}

base_filter := {} if {
    utils.is_admin
} else := qobject if {
    utils.is_sandbox
    user := input.auth.user
    qobject := ["|",
        {"owner": user.id},
        {"job__assignee": user.id},
        {"job__segment__task__owner": user.id},
        {"job__segment__task__assignee": user.id},
        {"job__segment__task__project__owner": user.id},
        {"job__segment__task__project__assignee": user.id},
    ]
} else := {} if {
    utils.is_organization
    utils.has_perm(utils.USER)
    organizations.has_perm(organizations.MAINTAINER)
} else := qobject if {
    organizations.has_perm(organizations.WORKER)
    user := input.auth.user
    qobject := ["|",
        {"owner": user.id},
        {"job__assignee": user.id},
        {"job__segment__task__owner": user.id},
        {"job__segment__task__assignee": user.id},
        {"job__segment__task__project__owner": user.id},
        {"job__segment__task__project__assignee": user.id},
    ]
}

filter := utils.add_organization_filter(base_filter, ["job__segment__task__organization"])

allow if {
    input.scope == utils.VIEW
    utils.is_sandbox
    is_mask_staff
}

allow if {
    input.scope == utils.VIEW
    input.auth.organization.id == input.resource.organization.id
    utils.is_organization
    utils.has_perm(utils.USER)
    organizations.has_perm(organizations.MAINTAINER)
}

allow if {
    input.scope == utils.VIEW
    input.auth.organization.id == input.resource.organization.id
    utils.is_organization
    utils.has_perm(utils.WORKER)
    organizations.is_member
    is_mask_staff
}

allow if {
    input.scope == utils.UPDATE
    utils.is_sandbox
    is_mask_admin
}

allow if {
    input.scope == utils.UPDATE
    input.auth.organization.id == input.resource.organization.id
    utils.is_organization
    utils.has_perm(utils.USER)
    organizations.has_perm(organizations.MAINTAINER)
}

allow if {
    input.scope == utils.UPDATE
    input.auth.organization.id == input.resource.organization.id
    utils.is_organization
    utils.has_perm(utils.WORKER)
    organizations.is_member
    is_mask_admin
}

allow if {
    input.scope == utils.DELETE
    utils.is_sandbox
    is_mask_admin
}

allow if {
    input.scope == utils.DELETE
    input.auth.organization.id == input.resource.organization.id
    utils.is_organization
    utils.has_perm(utils.USER)
    organizations.has_perm(organizations.MAINTAINER)
}

allow if {
    input.scope == utils.DELETE
    input.auth.organization.id == input.resource.organization.id
    utils.is_organization
    utils.has_perm(utils.WORKER)
    organizations.is_member
    is_mask_admin
}

# view_original scope: only task/project owner or org maintainer/admin can view raw unmasked original
allow if {
    input.scope == "view_original"
    utils.is_sandbox
    is_task_owner
}

allow if {
    input.scope == "view_original"
    utils.is_sandbox
    is_project_owner
}

allow if {
    input.scope == "view_original"
    input.auth.organization.id == input.resource.organization.id
    utils.is_organization
    utils.has_perm(utils.USER)
    organizations.has_perm(organizations.MAINTAINER)
}

allow if {
    input.scope == "view_original"
    input.auth.organization.id == input.resource.organization.id
    utils.is_organization
    utils.has_perm(utils.WORKER)
    organizations.is_member
    is_task_owner
}

allow if {
    input.scope == "view_original"
    input.auth.organization.id == input.resource.organization.id
    utils.is_organization
    utils.has_perm(utils.WORKER)
    organizations.is_member
    is_project_owner
}
