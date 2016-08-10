// https://tech.lds.org/wiki/Gospel_Library_Catalog_Web_Service

// var language = 2; // English
var language = 2; // Español
var platform = 1; // iPhone
// var platform = 17; // Android

function getJson(url, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", url);
  xhr.onload = function (evt) {
    var data;
    try {
      data = JSON.parse(this.responseText);
    }
    catch (err) {
      return callback(err);
    }
    return callback(null, data);
  };
  xhr.send();
}

function getBinary(url, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", url);
  xhr.responseType = "arraybuffer";
  xhr.onload = function (evt) {
    return callback(null, this.response);
  };
  xhr.send();
}

function getCatalog(callback) {
  var url =
    "http://tech.lds.org/glweb?action=catalog.query.modified&languageid=" +
    language + "&platformid=" + platform + "&format=json";
  console.log("Checking for catalog update...");
  return getJson(url, function (err, result) {
    if (err) return callback(err);
    var version = result.version;
    if (platform == localStorage.getItem("platform") &&
        language == localStorage.getItem("language") &&
        version == localStorage.getItem("version")) {
      console.log("No update, loading from cache.");
      return callback(null, JSON.parse(localStorage.getItem("catalog")));
    }
    var url =
      "http://tech.lds.org/glweb?action=catalog.query&languageid=" +
      language + "&platformid=" + platform + "&format=json";
    console.log("Updating catalog...");
    return getJson(url, function (err, result) {
      if (err) return callback(err);
      localStorage.setItem("catalog", JSON.stringify(result.catalog));
      localStorage.setItem("version", version);
      localStorage.setItem("language", language);
      localStorage.setItem("platform", platform);
      return callback(null, result.catalog);
    });
  });
}

function getZbook(book, callback) {
  getBinary(book.url, function (err, data) {
    if (err) return callback(err);
    console.log(data);
    data = pako.inflate(data);
    console.log(data);
    var db = new SQL.Database(data);
    console.log(db);
    var res = db.exec("SELECT * FROM nodes LIMIT 5");
    res = res[0];
    console.log(res);
    res.values.forEach(function (row) {
      var obj = {};
      res.columns.forEach(function (col, i) {
        obj[col] = row[i];
      });
      console.log(obj);
      if (obj.content) {
        document.write(obj.content);
      }
    });
    console.log(res);
  });
}

window.onload = function () {
  getCatalog(function (err, catalog) {
    if (err) throw err;
    var folder = catalog.folders[0];
    console.log("folder", folder);
    var book = folder.books[0];
    console.log("book", book);
    getZbook(book, function (err, db) {
      if (err) throw err;
      console.log(db);
    });
  });
};
