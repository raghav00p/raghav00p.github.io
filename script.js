const db = new Dexie('Hoppers' , {  addons: [DexieCloud.dexieCloud]});
db.version(1).stores({
  todos: '&id, name, start, end, content, color', //coma error
  habits:
    '&id, name, startedon, description,  streak, highest, total, freezer, color, schedule,  status, array',
  daily: '&date, content',
  journal: 'id, content, index, image',
  system: 'sort, rename',
}); //karta dharta
db.cloud.configure({databaseUrl: "https://zhvnsd946.dexie.cloud", requireAuth: true, unsyncedTables:["journal"]});

function toggle() {
  // hide element
  return {
    show: false,
    flip() {
      this.show = !this.show;
    },
  };
}

document.addEventListener('alpine:init', () => {
  Alpine.store('run', {
    pro: [],
    days: [],
    hab: [],
    ran: [],
    nav: 1,
    colors: [
      'red',
      'green',
      'blue',
      'violet',
      'yellow',
      'brown',
      'orange',
      'pink',
      'cyan',
      'indigo',
    ],

    menu: null,
    async init() {
      //for template🔴
      this.pro = await db.todos.toArray();
      this.hab = await db.habits.toArray();
      this.ran = await db.daily.toArray();
      //Date feature
      this.days = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        this.days.push(d.toISOString().slice(0, 10)); //compulsory
      }
      this.days.reverse();
      this.tooler = this.days[6];
    },
    async add() {
      //add button🔴
      const take = prompt();
      if (take && take.trim()) {
        const date = new Date();
        const start = date.toISOString().slice(0, 10);
        date.setDate(date.getDate() + 7);
        await db.todos.add({
          id: crypto.randomUUID(),
          name: take,
          content: [],
          checked: false,
          progress: 314,
          date: null,
          color: 'white',
          start: start,
          end: start,
        });
        this.pro = await db.todos.toArray();
      }
    },
    // habit headache
    async habitinit(id) {
      const insobj = this.hab.find((i) => i.id === id);
      const today = new Date().toISOString().slice(0, 10);
      function weekday(a) {
        return new Date(a).toLocaleDateString('us', { weekday: 'short' });
      }
      function set(d, n) {
        let bro = new Date(d);
        bro.setDate(bro.getDate() + n);
        return bro.toISOString().slice(0, 10);
      }
      let bigday = insobj.array.length
        ? insobj.array.reduce((a, b) => (a.date > b.date ? a : b)).date
        : today;
      for (; bigday <= today; bigday = set(bigday, 1)) {
        if (
          !insobj.array.some((b) => b.date === bigday) &&
          insobj.schedule.some((b) => b === weekday(bigday)) &&
          insobj.status
        ) {
          insobj.array.push({
            date: bigday,
            status: false,
            freezer: false,
          });
        }
      }
      let totalSav = 0;
      let streakSav = 0;
      insobj.array
        .filter((i) => i.date < set(today, -30))
        .forEach((i) => {
          if (i.status) {
            totalSav++;
            streakSav++;
          }
          if (!i.status && !i.freezer) {
            streakSav = 0;
          }
        });
      insobj.array = insobj.array.filter((i) => i.date >= set(today, -30)); // delete
      insobj.array.forEach((i) => {
        if (
          i.date >= set(today, -2) &&
          insobj.freezer.length &&
          !i.freezer &&
          !i.status &&
          i.date !== today
        ) {
          i.freezer = insobj.freezer.splice(0, 1)[0] ?? 0;
        }
      });
      //Calculate
      let i = 0;
      let Break = false;
      const reve = [...insobj.array].reverse();
      for (; i < reve.length; i++) {
        if (!reve[i].status && !reve[i].freezer) {
          Break = true;
          break;
        } else if (reve[i].freezer) {
          continue;
        }
      }

      insobj.percentage =
        (insobj.array.filter((i) => i.status).length * 100) /
        insobj.array.length; // 1

      // now main part
      const habs = await db.habits.get(id);
      insobj.total =
        totalSav + habs.total + insobj.array.filter((i) => i.status).length; // 2

      insobj.streak = Break ? i : streakSav + habs.streak + i; // 3
      insobj.highest = Math.max(insobj.streak, habs.highest); //4
      // 5 freezer
      //update
      try {
        await db.habits.update(id, {
          array: JSON.parse(JSON.stringify(insobj.array)),
          total: habs.total + totalSav,
          streak: habs.streak + streakSav,
          freezer: JSON.parse(JSON.stringify(insobj.freezer)),
          highest: insobj.highest,
        });
      } catch (err) {
        alert(err);
      }
    },

    getFormat(a) {
      const date = new Date(a);
      return date.toLocaleDateString('en-us', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });
    },
  });
});

document.addEventListener("alpine:init", () => {
Alpine.data('journal', () => ({
    id: '',
    content: '',
    index: 1,
    selectedDay: '',
    today: '',
    solution: [],
    days: [],
    imageUrl: '',
    async init() {
      this.days = await db.journal.toArray();
      this.today = new Date().toISOString().slice(0, 10);
      if (!this.days.some((d) => d.id === this.today)) {
        await db.journal.add({
          id: this.today,
          content: '',
          index: 1,
          image: null,
        });
        this.days = await db.journal.toArray();
      }
      await Promise.all(
        this.days
          .filter((d) => (new Date() - new Date(d.id)) / 864e5 >= 30)
          .map((d) => db.journal.delete(d.id))
      );
      this.selectedDay = this.today;
      this.load(
        this.days.find((d) => d.id === this.today),
        this.today
      );
    },

    localISODate() {
      const date = new Date();
      return date.toISOString().slice(0, 10);
    },
    async dave(file) {
      // save image
      await db.journal.update(this.id, {
        image: file,
      });
      this.imageUrl = URL.createObjectURL(file);
    },

    load(a) {
      // load everything
      this.id = a.id;
      this.content = a.content;
      this.index = a.index;
      if (a.image) {
        this.imageUrl = URL.createObjectURL(a.image);
      } else {
        this.imageUrl = '';
      }
    },
    async save(pop) {
      await db.journal.update(this.id, {
        content: pop,
      });
    },
    async mood() {
      this.index = (this.index + 1) % 3;
      await db.journal.update(this.id, {
        index: this.index,
      });
    },
  }));
});

document.addEventListener("alpine:init", () => {
  Object.assign(Alpine.store("run"), {
    tooler: '',
    rone: '',
    ransom: [],
    taskito: [],
    habitika: [],
    weekday(a) {
      const date = new Date(a).toLocaleDateString('us', { weekday: 'short' });
      return date;
    },
    async datte(h) {
      try {
        await db.daily.add({
          date: h,
          content: [],
        });
      } catch {}
      this.ran = await db.daily.toArray();
    },
    async adran(i) {
      await this.datte(i);
      const date = await db.daily.get(i);
      const take = prompt();
      if (!take || !take.trim()) return;
      date.content.push({
        name: take,
        checked: false,
        id: crypto.randomUUID(),
      });
      await db.daily.update(i, { content: date.content });
      this.ran = await db.daily.toArray();
    },
    async rcheck(i, n) {
      const date = await db.daily.get(i);
      const status = date.content.find((i) => i.id === n);
      status.checked = !status.checked;
      await db.daily.update(i, { content: date.content });
      this.ran = await db.daily.toArray();
    },
    async rmran(i, b) {
      const date = await db.daily.get(i);
      const index = date.content.findIndex((c) => c.id === b);
      if (index !== -1 && confirm()) {
        date.content.splice(index, 1);
        await db.daily.update(i, { content: date.content });
        if (!date.content.length) {
          await db.daily.delete(i);
        }
        this.ran = await db.daily.toArray();
      }
    },
    too(a) {
      this.tooler = a;

      //alert(this.tooler);
    },
    async hcheck(i, d) {
      const hab = this.hab.find((b) => b.id === i);
      const entry = hab.array.find((e) => e.date === d);
      const space = hab.freezer.length < 3;
      if ((entry.status = !entry.status)) {
        if (entry.freezer) {
          if (space) {
            hab.freezer.unshift(entry.freezer);
          }
          entry.freezer = 0;
        } // restore
        if (hab.total % 10 === 9 && space) {
          hab.freezer.push(hab.total + 1);
        } // earn
      } else {
        if (hab.total % 10 === 0 && space) {
          hab.freezer.pop(hab.total);
        } // undo earn
      }
      await db.habits.update(i, {
        array: hab.array,
        freezer: hab.freezer,
      });
      this.hab = await db.habits.toArray();
    },
    scroll(id) {
      const element = document.getElementById(id);

      if (!element) return;

      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });

      element.focus({
        preventScroll: true,
      });
    },
    clone: null,
    // shared progress calculator — accounts for subtask partial completion
    progress(content) {
      if (!content.length) return 314;
      const done = content.reduce((sum, task) => {
        if (task.subtask && task.subtask.length) {
          return (
            sum +
            task.subtask.filter((s) => s.checked).length / task.subtask.length
          );
        }
        return sum + (task.checked ? 1 : 0);
      }, 0);
      return 314 - Math.ceil((done * 314) / content.length);
    },

    async rm(i) {
      if (confirm()) {
        await db.todos.delete(i);
        this.pro = await db.todos.toArray();
      }
    },
    async up(i, u) {
      const take = prompt('edit', u);
      if (take && take.trim()) {
        await db.todos.update(i, { name: take });
        this.pro = await db.todos.toArray();
      }
    },
    async tad(i) {
      const take = prompt();
      if (take && take.trim()) {
        const todo = await db.todos.get(i);
        todo.content.push({ name: take, id: crypto.randomUUID(), subtask: [] });
        todo.progress = this.progress(todo.content);
        await db.todos.update(i, {
          content: todo.content,
          progress: todo.progress,
        });
        this.pro = await db.todos.toArray();
      }
    },
    async tup(i, u, b) {
      const take = prompt('edit', u);
      if (take && take.trim()) {
        const todo = await db.todos.get(i);
        const task = todo.content.find((t) => t.id === b);
        task.name = take;
        await db.todos.update(i, { content: todo.content });
        this.pro = await db.todos.toArray();
      }
    },
    async tcheck(i, b) {
      // task-level checkbox — only reachable when the task has no subtasks
      const todo = await db.todos.get(i);
      const task = todo.content.find((t) => t.id === b);
      task.checked = !task.checked;
      todo.progress = this.progress(todo.content);
      await db.todos.update(i, {
        content: todo.content,
        progress: todo.progress,
      });
      this.pro = await db.todos.toArray();
    },
    async scheck(i, b, d) {
      const todo = await db.todos.get(i);
      const task = todo.content.find((t) => t.id === b);
      const sub = task.subtask.find((t) => t.id === d);

      sub.checked = !sub.checked;
      // keep the task's own checkbox in sync with its subtasks
      task.checked = task.subtask.every((s) => s.checked);
      todo.progress = this.progress(todo.content);
      await db.todos.update(i, {
        content: todo.content,
        progress: todo.progress,
      });
      this.pro = await db.todos.toArray();
    },
    async tre(i, b) {
      const todo = await db.todos.get(i);
      const index = todo.content.findIndex((task) => task.id === b.id);
      if (index !== -1 && confirm()) {
        todo.content.splice(index, 1);
        todo.progress = this.progress(todo.content);
        await db.todos.update(i, {
          content: todo.content,
          progress: todo.progress,
        });
        this.pro = await db.todos.toArray();
      }
    },
    async tsort(id, position, i) {
      const todo = await db.todos.get(i);
      const index = todo.content.findIndex((item) => item.id === id);
      const [moved] = todo.content.splice(index, 1);
      todo.content.splice(position, 0, moved);
      await db.todos.update(i, { content: todo.content });
      this.pro = await db.todos.toArray();
    },
    async ssort(id, position, i, b) {
      const project = await db.todos.get(i);
      const task = project.content.find((t) => t.id === b);
      const index = task.subtask.findIndex((item) => item.id === id);
      const [moved] = task.subtask.splice(index, 1);
      task.subtask.splice(position, 0, moved);
      await db.todos.update(i, { content: project.content });
      this.pro = await db.todos.toArray();
    },
    async colorz(i, b) {
      const habit = await db.todos.get(i);
      habit.color = b;
      await db.todos.update(i, {
        color: habit.color,
      });
      this.pro = await db.todos.toArray();
    },
    async sede(i, value, too) {
      if (!too) {
        await db.todos.update(i, {
          start: value,
        });
      } else {
        const date = new Date(value);
        date.setDate(date.getDate() + 7);
        await db.todos.update(i, {
          start: value,
          end: date.toISOString().slice(0, 10),
        });
      }
      this.pro = await db.todos.toArray();
    },
    async sedi(i, value, too) {
      if (!too) {
        await db.todos.update(i, {
          end: value,
        });
      }
      this.pro = await db.todos.toArray();
    },
    async setDate(id, field, value) {
      const project = await db.todos.get(id);

      if (field === 'start' && value > project.end) {
        const d = new Date(value);
        d.setDate(d.getDate() + 7);
        project.end = d.toISOString().slice(0, 10);
      }

      if (field === 'end' && value < project.start) return;

      project[field] = value;
      await db.todos.put(project); // ✅ put() replaces the whole record — no key issues
      this.pro = await db.todos.toArray();
    },
    sorting(lett, key) {
      if (!lett.length) return lett;
      const saved = localStorage.getItem(key) ?? '[]';
      //alert(key + 'saved:' + saved + 'lett:' + lett.length);  ← add this
      console.log(saved);
      let savedOrder = JSON.parse(saved);
      // Remove items from savedOrder that no longer exist in lett
      savedOrder = savedOrder.filter((savedItem) =>
        lett.some((item) => item.id === savedItem.id)
      );
      // Update existing or add new items from lett
      lett.forEach((item) => {
        const index = savedOrder.findIndex(
          (savedItem) => savedItem.id === item.id
        );
        if (index !== -1) {
          // Replace existing item
          savedOrder[index] = item;
        } else {
          // Add new item
          savedOrder.push(item);
        }
      });
      // Save
      localStorage.setItem(
        key,
        JSON.stringify(savedOrder.map(({ id }) => ({ id })))
      );
      return savedOrder;
    },
    getStatus(d, b) {
      //weekday status 🧠
      const entry = b.find((i) => i.date === d);
      if (entry) {
        return entry.status ? 1 : 2;
      } else {
        return 3;
      }
    },
    async had() {
      // add habit 🟡
      const take = prompt();
      if (take && take.trim()) {
        await db.habits.add({
          id: crypto.randomUUID(),
          name: take,
          startedon: new Date().toLocaleDateString('us'),
          description: null,
          streak: 0,
          highest: 0,
          total: 0,
          freezer: [],
          color: this.colors[Math.floor(Math.random() * 10)],
          schedule: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
          status: true,
          array: [],
        });
        const rune = await db.habits.toArray();
        this.hab.push(rune[rune.length - 1]);
        this.hab = [...this.hab];
      }
    },
    async hre(i) {
      // remove habit🟡
      if (confirm()) {
        await db.habits.delete(i);
        this.hab = await db.habits.toArray();
      }
    },
    async note(i, b) {
      await db.habits.update(i, {
        description: b,
      });
    },
    sortage(id, position, key) {
      let thishab = JSON.parse(localStorage.getItem(key) ?? '[]');
      const index = thishab.findIndex((item) => item.id === id);
      const [moved] = thishab.splice(index, 1);
      thishab.splice(position, 0, moved);
      localStorage.setItem(
        key,
        JSON.stringify(thishab.map(({ id }) => ({ id })))
      );
    },
    jojo: 1,
    async push(a, habit) {
      const index = habit.schedule.indexOf(a);

      if (index === -1) {
        habit.schedule.push(a);
      } else {
        if (confirm()) {
          habit.schedule.splice(index, 1);
        }
      }
      await db.habits.update(habit.id, {
        schedule: [...habit.schedule],
      });
      this.hab.find((i) => i.id === habit.id).schedule = [...habit.schedule];
      this.habitinit(habit.id);
    },
    async colord(i, b) {
      const habit = await db.habits.get(i);
      await db.habits.update(i, {
        color: b,
      });
      this.hab.find((c) => c.id === i).color = b;
    },
    async pause(a) {
      let habit = this.hab.find((i) => i.id === a);
      if (!habit) return;
      habit.status = !habit.status;
      await db.habits.update(a, {
        status: status,
      });
    },
    async today(i, b) {
      const todo = await db.todos.get(i);
      const task = todo.content.find((t) => t.id === b);
      task.date = new Date().toISOString().slice(0, 10);
      await db.todos.update(i, {
        content: todo.content,
      });
      this.pro = await db.todos.toArray();
    },
    async tomorrow(i, b) {
      const todo = await db.todos.get(i);
      const task = todo.content.find((t) => t.id === b);
      const date = new Date();
      date.setDate(date.getDate() + 1);
      task.date = date.toISOString().slice(0, 10);
      await db.todos.update(i, {
        content: todo.content,
      });
      this.pro = await db.todos.toArray();
    },
    async sad(i, b) {
        const take = prompt();
        if (take && take.trim()) {
          const todo = await db.todos.get(i);
          const task = todo.content.find((t) => t.id === b);
          task.subtask.push({
            name: take,
            id: crypto.randomUUID(),
            checked: false,
          });
          task.checked = false; // a new unchecked subtask breaks a previously "done" task
          todo.progress = this.progress(todo.content);
          await db.todos.update(i, {
            content: todo.content,
            progress: todo.progress,
          });
          this.pro = await db.todos.toArray();
        }
      },
      async sre(i, b, c) {
        const todo = await db.todos.get(i);
        const task = todo.content.find((t) => t.id === b);
        const index = task.subtask.findIndex((sub) => sub.id === c);
        if (index !== -1 && confirm()) {
          task.subtask.splice(index, 1);
          if (task.subtask.length)
            task.checked = task.subtask.every((s) => s.checked);
          todo.progress = this.progress(todo.content);
          await db.todos.update(i, {
            content: todo.content,
            progress: todo.progress,
          });
          this.pro = await db.todos.toArray();
        }
      },
      Distance(a) {
        const now = new Date();
        const today = now.toISOString().slice(0, 10);
        const target = a.start <= today ? a.end : a.start; // current → count to end, upcoming → count to start
        const diff = new Date(target) - now;
        return Math.floor(Math.abs(diff) / (1000 * 60 * 60 * 24));
      },
    async today(i, b) {
      const todo = await db.todos.get(i);
      const task = todo.content.find((t) => t.id === b);
      task.date = new Date().toISOString().slice(0, 10);
      await db.todos.update(i, {
        content: todo.content,
      });
      this.pro = await db.todos.toArray();
    },
    async tomorrow(i, b) {
      const todo = await db.todos.get(i);
      const task = todo.content.find((t) => t.id === b);
      const date = new Date();
      date.setDate(date.getDate() + 1);
      task.date = date.toISOString().slice(0, 10);
      await db.todos.update(i, {
        content: todo.content,
      });
      this.pro = await db.todos.toArray();
    },
    async sad(i, b) {
        const take = prompt();
        if (take && take.trim()) {
          const todo = await db.todos.get(i);
          const task = todo.content.find((t) => t.id === b);
          task.subtask.push({
            name: take,
            id: crypto.randomUUID(),
            checked: false,
          });
          task.checked = false; // a new unchecked subtask breaks a previously "done" task
          todo.progress = this.progress(todo.content);
          await db.todos.update(i, {
            content: todo.content,
            progress: todo.progress,
          });
          this.pro = await db.todos.toArray();
        }
      },
      async sre(i, b, c) {
        const todo = await db.todos.get(i);
        const task = todo.content.find((t) => t.id === b);
        const index = task.subtask.findIndex((sub) => sub.id === c);
        if (index !== -1 && confirm()) {
          task.subtask.splice(index, 1);
          if (task.subtask.length)
            task.checked = task.subtask.every((s) => s.checked);
          todo.progress = this.progress(todo.content);
          await db.todos.update(i, {
            content: todo.content,
            progress: todo.progress,
          });
          this.pro = await db.todos.toArray();
        }
      },
      Distance(a) {
        const now = new Date();
        const today = now.toISOString().slice(0, 10);
        const target = a.start <= today ? a.end : a.start; // current → count to end, upcoming → count to start
        const diff = new Date(target) - now;
        return Math.floor(Math.abs(diff) / (1000 * 60 * 60 * 24));
      },
    async today(i, b) {
      const todo = await db.todos.get(i);
      const task = todo.content.find((t) => t.id === b);
      task.date = new Date().toISOString().slice(0, 10);
      await db.todos.update(i, {
        content: todo.content,
      });
      this.pro = await db.todos.toArray();
    },
    async tomorrow(i, b) {
      const todo = await db.todos.get(i);
      const task = todo.content.find((t) => t.id === b);
      const date = new Date();
      date.setDate(date.getDate() + 1);
      task.date = date.toISOString().slice(0, 10);
      await db.todos.update(i, {
        content: todo.content,
      });
      this.pro = await db.todos.toArray();
    },
    async sad(i, b) {
        const take = prompt();
        if (take && take.trim()) {
          const todo = await db.todos.get(i);
          const task = todo.content.find((t) => t.id === b);
          task.subtask.push({
            name: take,
            id: crypto.randomUUID(),
            checked: false,
          });
          task.checked = false; // a new unchecked subtask breaks a previously "done" task
          todo.progress = this.progress(todo.content);
          await db.todos.update(i, {
            content: todo.content,
            progress: todo.progress,
          });
          this.pro = await db.todos.toArray();
        }
      },
      async sre(i, b, c) {
        const todo = await db.todos.get(i);
        const task = todo.content.find((t) => t.id === b);
        const index = task.subtask.findIndex((sub) => sub.id === c);
        if (index !== -1 && confirm()) {
          task.subtask.splice(index, 1);
          if (task.subtask.length)
            task.checked = task.subtask.every((s) => s.checked);
          todo.progress = this.progress(todo.content);
          await db.todos.update(i, {
            content: todo.content,
            progress: todo.progress,
          });
          this.pro = await db.todos.toArray();
        }
      },
      Distance(a) {
        const now = new Date();
        const today = now.toISOString().slice(0, 10);
        const target = a.start <= today ? a.end : a.start; // current → count to end, upcoming → count to start
        const diff = new Date(target) - now;
        return Math.floor(Math.abs(diff) / (1000 * 60 * 60 * 24));
      },
    async today(i, b) {
      const todo = await db.todos.get(i);
      const task = todo.content.find((t) => t.id === b);
      task.date = new Date().toISOString().slice(0, 10);
      await db.todos.update(i, {
        content: todo.content,
      });
      this.pro = await db.todos.toArray();
    },
    async tomorrow(i, b) {
      const todo = await db.todos.get(i);
      const task = todo.content.find((t) => t.id === b);
      const date = new Date();
      date.setDate(date.getDate() + 1);
      task.date = date.toISOString().slice(0, 10);
      await db.todos.update(i, {
        content: todo.content,
      });
      this.pro = await db.todos.toArray();
    },
    async sad(i, b) {
        const take = prompt();
        if (take && take.trim()) {
          const todo = await db.todos.get(i);
          const task = todo.content.find((t) => t.id === b);
          task.subtask.push({
            name: take,
            id: crypto.randomUUID(),
            checked: false,
          });
          task.checked = false; // a new unchecked subtask breaks a previously "done" task
          todo.progress = this.progress(todo.content);
          await db.todos.update(i, {
            content: todo.content,
            progress: todo.progress,
          });
          this.pro = await db.todos.toArray();
        }
      },
      async sre(i, b, c) {
        const todo = await db.todos.get(i);
        const task = todo.content.find((t) => t.id === b);
        const index = task.subtask.findIndex((sub) => sub.id === c);
        if (index !== -1 && confirm()) {
          task.subtask.splice(index, 1);
          if (task.subtask.length)
            task.checked = task.subtask.every((s) => s.checked);
          todo.progress = this.progress(todo.content);
          await db.todos.update(i, {
            content: todo.content,
            progress: todo.progress,
          });
          this.pro = await db.todos.toArray();
        }
      },
      Distance(a) {
        const now = new Date();
        const today = now.toISOString().slice(0, 10);
        const target = a.start <= today ? a.end : a.start; // current → count to end, upcoming → count to start
        const diff = new Date(target) - now;
        return Math.floor(Math.abs(diff) / (1000 * 60 * 60 * 24));
      }
  });
});
