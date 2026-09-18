const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDocFromServer } = require('firebase/firestore');
const config = require('./firebase-applet-config.json');

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function test() {
  try {
    console.log("Testing connection...");
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Connection successful or different error.");
  } catch (e) {
    console.error("Error:", e.message);
  }
}
test();
