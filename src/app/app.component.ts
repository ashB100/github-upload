import { CdkDragDrop, transferArrayItem } from '@angular/cdk/drag-drop';
import { Component } from '@angular/core';
import { AngularFirestore, AngularFirestoreCollection } from '@angular/fire/firestore';
import { MatDialog } from '@angular/material/dialog';
import { BehaviorSubject } from 'rxjs';
import { TaskDialogComponent, TaskDialogResult } from './task-dialog/task-dialog.component';
import { Task } from './task/task';

const getObservable = (collection: AngularFirestoreCollection<Task>) => {
  const subject = new BehaviorSubject<Task[] | []>([]);
  collection.valueChanges({ idField: 'id'})
    .subscribe((val: Task[]) => {
      subject.next(val);
    });
  return subject;
};

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  // Our source of truth is firestore, at the same time we have
  // local copies of the data.
  // When any of the observables associated with a colleciton
  // emits, we get an array of tasks. When we move a task from
  // one collection to another (todo, inProgress, done), we evoke
  // transferArrayItem which operates on the local instances of
  // the arrays. The Firebase sdk treats these arrays as immutable.
  // Meaning that the next time Angular runs change detection,
  // we'll get new instances of them which will render the previous
  // state before we transfer the task. At the same time we'll
  // trigger a Firestore update and the Firebase SDK will
  // trigger an update with the correct values, so in a few milliseconds
  // the UI will get its correct state. This will make the task
  // to transfer, just jump from the first list to the second one.
  // We need to make sure we're maintaining consistent state until
  // our data updates. For the purpose we will take advantage of BehaviorSubject
  // to wrap the original value we receive from valueChanges(). Under the hood
  // BehaviorSubject will keep a mutable array which will persist the update
  // from transfer array item.

  // BehaviourSubject will persist the value across change-detection runs.
  // This way we can move an item from one collection to another
  // without leaving data in an inconsistent state.

  // valueChanges() returns an observable which will emit new values everytime when the collection changes
  // Configure firestore to use 'id' as the idField

  todo = getObservable(this.firestore.collection('todo'));
  inProgress = getObservable(this.firestore.collection('inProgress'));
  done = getObservable(this.firestore.collection('done'));

  // todo = this.firestore.collection('todo').valueChanges({ idField: 'id'});
  // inProgress = this.firestore.collection('inProgress').valueChanges({ idField: 'id'});;
  // done = this.firestore.collection('done').valueChanges({ idField: 'id'});

  constructor(
    private dialog: MatDialog,
    private firestore: AngularFirestore
  ) {}

  drop(event: CdkDragDrop<Task[] | any>): void {
    if (event.previousContainer === event.container) {
      return;
    }
    const item = event.previousContainer.data[event.previousIndex];
    this.firestore.firestore.runTransaction(() => {
      // move the task from the current swimlane to the one the user has dropped it in
      return Promise.all([
        this.firestore.collection(event.previousContainer.id).doc(item.id).delete(),
        this.firestore.collection(event.container.id).add(item)
      ]);
    });
    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex
    );
  }

  edit(list: 'done' | 'todo' | 'inProgress', task: Task): void {
    const dialogRef = this.dialog.open(TaskDialogComponent, {
      width: '270px',
      data: {
        task,
        enableDelete: true
      }
    });
    dialogRef
      .afterClosed()
      .subscribe((result: TaskDialogResult) => {
        if (result.delete) {
          this.firestore.collection(list).doc(task.id).delete();
        } else {
          this.firestore.collection(list).doc(task.id).update(task);
        }
        // const dataList = this[list];
        // const taskIndex = dataList.indexOf(task);
        // if (result.delete) {
        //   dataList.splice(taskIndex, 1);
        // } else {
        //   dataList[taskIndex] = task;
        // }
      });
  }

  newTask(): void {
    const dialogRef = this.dialog.open(TaskDialogComponent, {
      width: '270px',
      data: {
        task: {}
      }
    });
    dialogRef
      .afterClosed()
      .subscribe((result: TaskDialogResult) => this.firestore
        .collection('todo')
        .add(result.task));
  }
}
