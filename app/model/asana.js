const m = require('mithril')
const Status = require('../components/Status')
const jsonstore = require('../utils/jsonstore')
const x = require('../utils/xhr-with-auth')(m)
const columnChangeColumnName = 'column-change'
const columnColorName = 'color'
const Asana = {
    workspaceId: '',
    pat: '',
    projects: [],
    customFieldId: '',
    colorFieldId: '',
    projectId: '',
    sectionMeta: {},
    sections: {},
    swimlanes: [],
    swimlanesDisplay: [],
    swimlaneColumns: {},
    tasks: {},
    columnTasks: {},
    projectTags: {},
    queue: [],
    users: {},
    usersOrder: [],
    usersInTasks: [],
    atValues: [],
    tags: [],
    createNew: false,
    testing: false,
    searchXhr: null,
    loadingProjects: false,
    clearSwimlaneData() {
        this.swimlaneColumns = {}
        this.swimlanesDisplay = []
        this.swimlanes = []
    }, 
    clearTaskData() {
        this.tasks = {}
        this.columnTasks = {}
        this.projectTags = {}
    }, 
    initFromStorage() {
        if (jsonstore.has('workspaceId')) {
            this.workspaceId = jsonstore.get('workspaceId')
        }
        if (jsonstore.has('pat')) {
            this.pat = jsonstore.get('pat')
        }
        if (jsonstore.has('customFieldId')) {
            this.customFieldId = jsonstore.get('customFieldId')
        }
        if (jsonstore.has('colorFieldId')) {
            this.colorFieldId = jsonstore.get('colorFieldId')
        }
        if (jsonstore.has('projectId')) {
            this.projectId = jsonstore.get('projectId')
        }
    },
    isSetup() {
        return jsonstore.has('pat') &&
            jsonstore.has('workspaceId') &&
            jsonstore.has('projectId') &&
            jsonstore.has('customFieldId') &&
            jsonstore.has('colorFieldId')
    },
    startSyncLoops() {
        self.setTimeout(Asana.syncLoop, 1000)
        self.setInterval(async () => {
            // if the queue is empty
            Asana.loadTasks()
            console.log(Asana.tasks)
        }, 2000)
    },
    isSectionComplete(section) {
        let name = this.getSectionAndSwimlane(section).sectionName
        return name === 'done' || name.startsWith('complete') || name.startsWith('finish')
    },
    async loadProject(offset) {
        if (!offset) {
            offset = ''
        } else {
            offset = '&offset=' + offset
        }
        x.request({ url: `https://app.asana.com/api/1.0/projects?limit=100${offset}&archived=false&workspace=${this.workspaceId}` }).then(async (response) => {
            this.projects.push(...response.data)
            if (response.next_page) {
                await this.loadProject(response.next_page.offset)
            }
            this.projects = this.projects.sort((a, b) => {
                return a.name.localeCompare(b.name)
            })
            this.projects.unshift({ name: 'Please select', gid: '-1' })
            this.loadingProjects = false
        }).catch((e) => {
            console.error(e)
            this.loadingProjects = false
        })
    },
    async loadAllProjects() {
        if (!this.pat) {
            return
        }
        this.projects = []
        this.loadingProjects = true
        if (jsonstore.has('projects')) {
            this.projects = jsonstore.get('projects')
            this.loadingProjects = false
            m.redraw()
        }
        this.loadProject('')
    },
    setWorkspaceId(workspaceId) {
        this.workspaceId = workspaceId
        jsonstore.set('workspaceId', workspaceId)
    },
    setPat(pat) {
        this.pat = pat
        jsonstore.set('pat', pat)
    },
    setProjectId(projectId) {
        this.projectId = projectId
        jsonstore.set('projectId', projectId)
    },
    setChangeFieldId(customFieldId) {
        this.customFieldId = customFieldId
        jsonstore.set('customFieldId', customFieldId)
    },
    setColorFieldId(customFieldId) {
        this.colorFieldId = customFieldId
        jsonstore.set('colorFieldId', customFieldId)
    },
    async createCustomField(name) {
        let value = await x.request({
            url: `https://app.asana.com/api/1.0/custom_fields`,
            method: 'POST',
            data: {
                'data': {
                    'name': name,
                    'type': 'text',
                    'workspace': this.workspaceId
                }
            },
            background: true
        }).then((response) => {
            return response.data.gid
        }).catch(() => {
            return 'already created'
        })
        if (value === 'already created') {
            value = await x.request({
                url: `https://app.asana.com/api/1.0/workspaces/${this.workspaceId}/custom_fields`,
                background: true
            }).then((response) => {
                for (let cf of response.data) {
                    if (cf.name === name) {
                        return cf.gid
                    }
                }
                return '-1'
            }).catch(() => {
                return '-1'
            })
        }
        // Add to project
        if (value !== '-1') {
            await x.request({
                method: 'POST',
                url: `https://app.asana.com/api/1.0/projects/${this.projectId}/addCustomFieldSetting`,
                data: {
                    'data': {
                        'custom_field': `${value}`
                    }
                },
                background: true
            }).then((response) => {
                console.info(response)
            }).catch(() => {
                // do nothing.
            })
        }
        return value
    },
    async setupProject() {
        let changeColumnId = await this.createCustomField(columnChangeColumnName)
        let colorColumnId = await this.createCustomField(columnColorName)
        this.setChangeFieldId(changeColumnId)
        this.setColorFieldId(colorColumnId)
    },
    processSections(response) {
        for (let section of response.data) {
            if (section.name.toLowerCase() === '(no section)') {
                continue
            }
            let ss = this.getSectionAndSwimlane(section)
            if (!ss) {
                continue
            }
            if (!this.sectionMeta[ss.sectionName]) {
                this.sectionMeta[ss.sectionName] = { count: 0, maximum: ss.maximum }
            }
            if (!this.contains(this.swimlanes, ss.swimlaneName)) {
                this.swimlanes.push(ss.swimlaneName)
                this.swimlanesDisplay.push(ss.swimlaneNameDisplay)
                this.swimlaneColumns[ss.swimlaneName] = []
            }
            ss.sectionId = section.gid
            if (!this.containsSS(this.swimlaneColumns[ss.swimlaneName], ss)) {
                this.swimlaneColumns[ss.swimlaneName].push(ss)
            }
            this.sections[`${section.gid}`] = section
        }
    },
    containsSS(haystack, needle) {
        for (let n of haystack) {
            if (n.sectionName === needle.sectionName && n.swimlaneName === needle.swimlaneName) {
                return true
            }
        }
        return false
    },
    async loadSections(withCache) {
        if (!withCache) {
            this.clearSwimlaneData()
            this.sectionMeta = {}
            this.sections = {}
        }

        if (jsonstore.has('sections') && withCache) {
            let response = jsonstore.get('sections')
            this.processSections(response)
        }
        x.request({ url: `https://app.asana.com/api/1.0/projects/${this.projectId}/sections` }).then((response) => {
            
            jsonstore.set('sections', response)
            this.processSections(response)
        })
        
    },
    contains(haystack, needle) {
        for (const n of haystack) {
            if (n === needle) {
                return true
            }
        }
        return false
    },
    getSectionAndSwimlane(section) {
        let name = section.name
        let colonIndex = name.indexOf(':')
        if (colonIndex === -1) {
            return null
        }

        let barIndex = name.indexOf('|')
        let maximum = 1000
        if (barIndex !== -1) {
            try {
                maximum = parseInt(name.substring(barIndex + 1))
                name = name.substring(0, barIndex)
            } catch (e) {
                console.warn(e)
            }
        }
        return {
            sectionName: name.substring(colonIndex + 1).toLowerCase().replace(/ /g, ''),
            swimlaneName: name.substring(0, colonIndex).toLowerCase().replace(/ /g, ''),
            sectionNameDisplay: name.substring(colonIndex + 1),
            swimlaneNameDisplay: name.substring(0, colonIndex),
            maximum: maximum,
            count: 0
        }
    },
    async loadTasks(withCache) {
        let taskFields = 'custom_fields,tags.name,tags.color,memberships.section.name,memberships.project.name,name,assignee.photo,assignee.name,assignee.email,due_on,modified_at,html_notes,notes,stories'
        let response = await x.request({ url: `https://app.asana.com/api/1.0/tasks?completed_since=${new Date().toISOString()}&project=${this.projectId}&opt_fields=${taskFields}` }).then((response) => {
            return response
        })
        if (!withCache) {
            this.clearTaskData()
        }
        for (let task of response.data) {
            for (let membership of task.memberships) {
                if (membership.project.gid === this.projectId) {
                    let ss = this.getSectionAndSwimlane(membership.section)
                    if (ss) {
                        this.tasks[task.gid] = task
                        if (!this.columnTasks[membership.section.gid]) {
                            this.columnTasks[membership.section.gid] = []
                        }
                        if (!this.columnHasTask(this.columnTasks[membership.section.gid], task)) {
                            this.columnTasks[membership.section.gid].push(task)
                            this.sectionMeta[ss.sectionName].count++
                        }
                    }
                }
            }
        }
        for (let key in this.tasks) {
            let task = this.tasks[key]
            this.rejiggerFields(task)
        }
    },
    columnHasTask(columnTasks, task) {
        for (let ct of columnTasks) {
            if (ct.gid === task.gid) {
                return true
            }
        }
        return false
    },
    rejiggerFields(task) {
        if (!task.custom_fields) {
            task.custom_fields = []
        }
        if (task.memberships.length > 1) {
            task.memberships = task.memberships.sort((a, b) => {
                if (a.project.gid === this.projectId) {
                    return -1
                } else {
                    return 1
                }
            })
        }
        task.custom_fields = task.custom_fields.sort((a, b) => {
            if (a.gid.gid === this.customFieldId) {
                return -1
            } else {
                return 1
            }
        })
        if (task.custom_fields.length === 0 || task.custom_fields[0].gid !== this.customFieldId) {
            task.custom_fields.splice(0, 0, {
                gid: this.customFieldId,
                text_value: ''
            });
        }
        if (task.custom_fields.length === 1 || task.custom_fields[1].gid !== this.colorFieldId) {
            task.custom_fields.splice(1, 0, {
                gid: this.colorFieldId,
                text_value: ''
            });
        }
        if (task.tags) {
            for (let tag of task.tags) {
                this.addProjectTag(tag)
            }
        }
    },
    addProjectTag(tag) {
        let color = this.convertTagColor(tag.color)
        this.projectTags[tag.gid] = {
            name: tag.name,
            color: color,
            id: tag.gid
        }
    },
    search(searchValue) {
        searchValue = searchValue.toLowerCase()
        let emptySearch = searchValue.trim() === ''
        for (let key in Asana.sections) {
            Asana.sections[key].highlight = false
        }
        for (let key in Asana.tasks) {
            let task = Asana.tasks[key]
            let text = task.name.toLowerCase()
            for (let tag of task.tags) {
                if (tag.name) {
                    text += ' ' + tag.name.toLowerCase()
                }
            }
            if (task.assignee) {
                text += ' ' + task.assignee.name.toLowerCase()
            }
            task.hidden = false
            if (!emptySearch) {
                if (text.indexOf(searchValue) === -1) {
                    task.hidden = true
                } else {
                    Asana.sections[task.memberships[0].section.gid].highlight = true
                }
            }
        }
    },
    async searchAsana(searchValue) {
        if (Asana.searchXhr !== null) {
            Asana.searchXhr.abort()
        }
        Asana.searchXhr = null
        return await x.request({
            config: function (xhr) { Asana.searchXhr = xhr },
            url: `https://app.asana.com/api/1.0/workspaces/${this.workspaceId}/typeahead?resource_type=task&query=${encodeURIComponent(searchValue)}&count=5&opt_fields=completed,name`
        }).then((response) => {
            return response.data.map((item) => {
                return { id: item.gid, value: (item.completed ? '✓ ' : '') + item.name }
            })
        })
    },
    async loadTags(bustCache) {
        if (jsonstore.has('tags')) {
            this.tags = jsonstore.get('tags')
        }
        x.request({ url: `https://app.asana.com/api/1.0/tags?workspace=${this.workspaceId}&opt_fields=color,name` }).then((response) => {
            jsonstore.set('tags', response.data)
            this.tags = response.data
        })
    },
    convertTagColor(c) {
        if (!c) {
            return 'background-color:gray;'
        }
        if (c.indexOf('light-') !== -1) {
            return c.replace(/light-(.*)/g, 'filter: brightness(120%); background-color:$1;')
        } else if (c.indexOf('dark-') !== -1) {
            return c.replace(/dark-(.*)/g, 'filter: brightness(80%); background-color:$1;color:white;')
        } else {
            return 'background-color:' + c
        }
    },
    taskMoved(sourceSectionId, targetSectionId, taskId, siblingTaskId) {
        this.queue.push({
            method: 'POST',
            url: `https://app.asana.com/api/1.0/sections/${targetSectionId}/addTask`,
            body: {
                "data": {
                    "task": taskId,
                    "insert_before": siblingTaskId,
                }
            },
            message: `moving ${taskId}`,
            callback: (response) => {
                console.info(response)
            }
        })
        if (sourceSectionId !== targetSectionId) {
            this.updateCustomFields(taskId, '')
        }
        Status.set('yellow', `syncing ${this.queue.length} items`)
    },
    updateCustomFields(taskId, color) {
        if (this.customFieldId === '-1' && this.colorFieldId === '-1'){
            return
        }
        let customFieldBody = {
            'data': {
                "custom_fields": {

                },
            }
        }
        if (this.customFieldId !== '-1') {
            customFieldBody.data.custom_fields[`${this.customFieldId}`] = new Date().toISOString()
            this.tasks[taskId].custom_fields[0].text_value = new Date().toISOString()
        }
        if (this.colorFieldId !== '-1' && color !== '') {
            customFieldBody.data.custom_fields[`${this.colorFieldId}`] = color
            this.tasks[taskId].custom_fields[1].text_value = color
        }
        this.queue.push({
            method: 'PUT',
            url: `https://app.asana.com/api/1.0/tasks/${taskId}`,
            body: customFieldBody,
            message: `updating last modified ${taskId}`,
            callback: (response) => {
                console.info(response)
            }
        })
    },
    async syncLoop() {
        let didSomeSyncing = false
        let errorFree = true
        while (Asana.queue.length > 0 && errorFree) {
            let queueItem = Asana.queue[0]
            let message = ''
            if (queueItem.message) {
                message = `<span style="font-size:7px" class="ml-4 opacity-50">${queueItem.message}<span>`
            }
            Status.set('yellow', `syncing ${Asana.queue.length} items${message}`)
            await x.request({ url: queueItem.url, data: queueItem.body, method: queueItem.method }).then(queueItem.callback).catch((error) => {
                console.error(error)
                let message = error.message
                if (error.response && error.response.data && error.response.data.errors) {
                    message = error.response.data.errors[0].message
                }
                Status.set('red', message)
                errorFree = false
            })
            Asana.queue.shift()
            didSomeSyncing = true
        }
        if (didSomeSyncing && errorFree) {
            Status.set('green', `sync'd`)
        }
        if (errorFree) {
            self.setTimeout(Asana.syncLoop, 500)
        }
    },
    release(sectionName) {
        let count = this.sectionMeta[sectionName].count
        let confirmed = confirm(`Release ${count} task${count > 1 ? 's' : ''} and mark as complete?`)
        if (confirmed) {
            for (let key in this.tasks) {
                let task = this.tasks[key]
                if (sectionName === this.getSectionAndSwimlane(task.memberships[0].section).sectionName) {
                    this.queue.push({
                        method: 'PUT',
                        url: `https://app.asana.com/api/1.0/tasks/${key}`,
                        body: {
                            "data": {
                                "completed": true
                            }
                        },
                        message: `releasing ${key}`,
                        callback: (response) => {
                            console.info(response)
                        }
                    })
                    let taskEl = document.getElementById(`task${key}`)
                    taskEl.parentNode.removeChild(taskEl)
                    delete this.tasks[key]
                    this.sectionMeta[sectionName].count--
                    Status.set('yellow', `syncing ${this.queue.length} items`)
                }
            }
        }
    },
    async loadUsers() {
        if (jsonstore.has('users')) {
            this.processUsers(jsonstore.get('users'))
        }
        x.request({ url: `https://app.asana.com/api/1.0/users?opt_fields=name,photo.image_60x60,resource_type,email` }).then((response) => {
            jsonstore.set('users', response)
            this.processUsers(response)
        })
    },
    processUsers(data) {
        let users = {}
        let userWithSearchspring = {}
        for (let user of data.data) {
            if (user.name.indexOf('@') !== -1) {
                continue
            }
            users[user.gid] = user
            if (user.email.indexOf("@searchspring") !== -1) {
                userWithSearchspring[user.name] = true
            }
        }
        let dedupedUsers = []
        for (let key in users) {
            let user = users[key]
            if (user.email.indexOf('@searchspring') === -1 && userWithSearchspring[user.name]) {
                continue
            }
            dedupedUsers.push(user)
        }
        this.users = {}
        this.usersOrder = []
        this.atValues = []
        for (let user of dedupedUsers) {
            this.users[user.gid] = user
            this.usersOrder.push(user)
        }
        this.usersOrder.sort((a, b) => {
            return a.name.localeCompare(b.name)
        })
        for (let user of this.usersOrder) {
            this.atValues.push({ id: user.gid, value: user.name + (user.email.indexOf('@searchspring') === -1 ? (' (' + user.email + ')') : '') })
        }

        this.usersInTasks = []
        for (let user of this.usersOrder) {
            this.usersInTasks.push(user)
        }
        let usersInTasks = {}
        for (let key in this.tasks) {
            let task = this.tasks[key]
            if (task.assignee) {
                usersInTasks[task.assignee.gid] = task.assignee
            }
        }
        if (Object.keys(usersInTasks).length > 0) {
            this.usersInTasks.unshift({ name: '----' })
        }
        for (let key in usersInTasks) {
            this.usersInTasks.unshift(usersInTasks[key])
        }
    },
    convertToAsana(text) {
        let regMention = /<span class="mention" data-index="[0-9]*" data-denotation-char="[@#]" data-id="([0-9]+)" data-value="[^"]*">\s*<span contenteditable="false">\s*<span class="ql-mention-denotation-char">[@#]<\/span>([^<]+)<\/span>\s*<\/span>/g
        return text.replace(regMention, '<a href="https://app.asana.com/0/$1/" data-asana-dynamic="true" data-asana-gid="$1" data-asana-accessible="true" data-asana-type="user">$2</a>')
            .replace(/<span>/g, '')
            .replace(/<\/span>/g, '\n')
            .replace(/<br>/g, '\n').trim()
    },
    convertFromAsana(text) {
        return text
    }
}

module.exports = Asana