import { inflate } from "pako";
import { Database } from "sql.js";

// https://tech.lds.org/wiki/Gospel_Library_Catalog_Web_Service

// let language = 2; // English
let language = "2"; // Español
let platform = "1"; // iPhone
// let platform = 17; // Android


async function getText(url: string) {
  return new Promise<string>((resolve, reject) => {
    let xhr = new XMLHttpRequest();
    xhr.open("GET", url);
    xhr.onload = evt => {
      resolve(xhr.responseText);
    };
    xhr.onerror = evt => {
      reject(new Error("Error in XHR Request: " + xhr.statusText));
    };
    xhr.send();
  });
}

async function getBinary(url: string) {
  return new Promise<Uint8Array>((resolve, reject) => {
    let xhr = new XMLHttpRequest();
    xhr.open("GET", url);
    xhr.responseType = "arraybuffer";
    xhr.onload = evt => {
      return resolve(new Uint8Array(xhr.response));
    };
    xhr.onerror = evt => {
      reject(new Error("Error in XHR Request: " + xhr.statusText));
    };
    xhr.send();
  });
}

async function getJson(url: string) {
  return JSON.parse(await getText(url));
}

async function getLanguages() {
  console.log("Getting list of supported languages...");
  return await getJson(
    "http://tech.lds.org/glweb?action=languages.query&format=json"
  );
}

async function getCatalog() {
  console.log("Checking for catalog update...");
  let update = await getJson(
    "http://tech.lds.org/glweb?action=catalog.query.modified&languageid=" +
    language + "&platformid=" + platform + "&format=json"
  );
  let version = update.version;
  if (platform == localStorage.getItem("platform") &&
      language == localStorage.getItem("language") &&
      version == localStorage.getItem("version")) {
    console.log("No update, loading from cache.");
    return JSON.parse(localStorage.getItem("catalog"));
  }
  console.log("Updating catalog...");
  let result = await getJson(
    "http://tech.lds.org/glweb?action=catalog.query&languageid=" +
    language + "&platformid=" + platform + "&format=json"
  );
  localStorage.setItem("catalog", JSON.stringify(result.catalog));
  localStorage.setItem("version", version);
  localStorage.setItem("language", language);
  localStorage.setItem("platform", platform);
  return result.catalog;
}

async function getZbook(book) {
  let data = await getBinary(book.url);
  console.log(data);
  data = inflate(data);
  console.log(data);
  let db = new Database(data);
  console.log(db);
  let res = db.exec("SELECT * FROM nodes WHERE content IS NOT NULL LIMIT 5")[0];
  console.log(res);
  res.values.forEach(function (row) {
    let obj:any = {};
    res.columns.forEach(function (col, i) {
      obj[col] = row[i];
    });
    console.log(obj);
    document.write(obj.content + obj.refs);
  });
  console.log(res);
}


window.onload = async function () {
  let langs = await getLanguages();
  let catalog = await getCatalog();
  let folder = catalog.folders[0];
  console.log("folder", folder);
  let book = folder.books[0];
  console.log("book", book);
  let db = await getZbook(book);
  console.log(db);
};
