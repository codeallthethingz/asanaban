const m = require('mithril')
const Asana = require('../model/asana')
const Asanaban = require('../model/asanaban')
const Task = require('./Task')
module.exports = {
    collapsed: false,
    view(vnode) {
        let c = vnode.attrs.column
        this.collapsed = localStorage.getItem(`collapsed-${c.sectionName}`) === 'true'
        let style = `flex-1 ml-1 ${this.collapsed ? 'collapsed' : ''}`
        let count = Asana.sectionMeta[c.sectionName].count
        let tasks = Asana.columnTasks[c.sectionId] || []
        let styles = this.getColumnStyle(c)
        return (
            <div class={style}>
                <a id="sectionHeader${id}" href="javascript:;" onclick={() => {
                    Asanaban.toggleColumn(c.sectionName)
                }} class={styles.header}>
                    <div class="flex">
                        <span data-section-id="${id}" class="flex-1 text-gray-400 hover:underline hover:text-white inline-block ml-1 mr-1 pt-1 text-xs text-left">add task</span>
                        <span class="flex-expand whitespace-no-wrap">{c.sectionNameDisplay}</span>
                        <span class="flex-1 text-right">{c.maximum === 1000 ? null : <span class="ml-4 mr-1 text-xs text-gray-600"><span class="count${name}">{count}</span> of {c.maximum}</span>}
                            {c.sectionName === 'done' || c.sectionName.startsWith('complete') || c.sectionName.startsWith('finish') ? <span data-section="${name}" class="text-gray-400 hover:underline hover:text-white inline-block mr-1 pt-1 text-xs">release</span> : null}
                        </span>
                    </div>
                </a>
                <div style="min-height:50px;" class={styles.column} id="section${id}">
                    {tasks.map((task, index) => {
                        return <Task task={task} key={index} />
                    })}
                </div>
            </div>
        )
    },
    getColumnStyle(c) {
        let section = Asana.sections[c.sectionId]
        let sectionName = Asana.getSectionAndSwimlane(section).sectionName
        let count = Asana.sectionMeta[sectionName].count
        let maximum = Asana.sectionMeta[sectionName].maximum
        let columnColor = count > maximum ? 'bg-red-gradient' : 'bg-gray-gradient'
        let headerColor = count > maximum ? 'column-header-red' : ''
        return {
            column: `${columnColor} tasks flex flex-wrap pt-1 pr-1 rounded-b`,
            header: `${headerColor} hover:opacity-75 column-header text-white text-bold p-1 block rounded-t`
        }
    }
}