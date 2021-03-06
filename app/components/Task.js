const m = require('mithril')
const Asana = require('../model/asana')
const dateFns = require('date-fns')
const { openEditTaskEditor } = require('./TaskEditor')
module.exports = {
    view(vnode) {
        let task = vnode.attrs.task
        let sectionId = vnode.attrs.task.memberships[0].section.gid
        let hasImage = task.assignee && task.assignee.photo
        let imageClasses = `${hasImage ? '' : 'hidden'} h-6 w-6 rounded-lg inline-block mr-2`
        let styles = this.getTaskStyles(task, sectionId)
        let wrapperStyles = `${task.hidden ? 'hidden' : ''} border-1`
        return <div style="width:50%; max-width:15rem" onclick={() => { openEditTaskEditor(task, sectionId) }} id={`task${task.gid}`} class={wrapperStyles}>
            <div style={styles.taskStyle} class={styles.taskClass}>
                <img alt="user image" id="photo${task.gid}" class={imageClasses} src={hasImage ? task.assignee.photo['image_60x60'] : 'images/blank.png'} />
                <span id="taskName${task.gid}">{task.name}</span>
                <div id="taskDate${task.gid}">
                    {task.due_on ? <div style="font-size:8px" class="text-left mt-1 border-t ${border}">Due Date<span class="float-right">{task.due_on}</span></div> : null}
                </div>
                <div class="flex mt-1">
                    {task.tags.map((tag, index) => {
                        let style = `${Asana.convertTagColor(tag.color)};margin-right:1px;overflow-hidden;max-width:1.3rem;`
                        return <div title={tag.name} style={style} class="border border-1 text-center border-white rounded-full flex-1 mb-1">{tag.name.substring(0, 1).toLowerCase()}</div>
                    })}
                </div>
            </div>
        </div>
    },
    getTaskStyles(task, sectionId) {
        let lastMod = this.getCustomFieldDate(task)
        let daysSinceMove = dateFns.differenceInDays(new Date(), lastMod)
        if (daysSinceMove > 30) {
            daysSinceMove = 30
        }
        let taskBg = ''
        let taskBg2 = ''
        if (task.due_on) {
            if (dateFns.differenceInDays(dateFns.parse(task.due_on), new Date()) < 5) {
                taskBg = 'bg-red-600 text-white'
            } else {
                taskBg = 'bg-purple-600 text-white'
            }
        } else if (task.custom_fields[1].text_value) {
            taskBg2 = `background-color: ${task.custom_fields[1].text_value};`
        }
        let opacity = ((100 - (daysSinceMove * 2.3)) / 100) + 0.2
        if (Asana.isSectionComplete(Asana.sections[sectionId])) {
            opacity = 1
        }
        return {
            taskClass: `${taskBg} hover:shadow border rounded ml-1 bg-white mb-1 pt-1 px-1 cursor-pointer text-xxs`,
            taskStyle: `${taskBg2} overflow:hidden; opacity:${opacity}`
        }
    }, getCustomFieldDate(task) {
        if (Asana.customFieldId !== '-1') {
            for (let customField of task.custom_fields) {
                if (customField.gid = Asana.customFieldId) {
                    if (!customField.text_value || customField.text_value.trim() === '') {
                        return new Date()
                    }
                    let parsed = dateFns.parse(customField.text_value)
                    if (parsed.toString() === 'Invalid Date') {
                        return new Date()
                    }
                    return parsed
                }
            }
        }
        return new Date()
    }
}