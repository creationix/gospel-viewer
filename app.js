"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator.throw(value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
const pako_1 = require("pako");
const sql_js_1 = require("sql.js");
let language = "2";
let platform = "1";
function fetchJson(url) {
    return __awaiter(this, void 0, void 0, function* () {
        let res = yield fetch(url);
        return yield res.json();
    });
}
function fetchBinary(url) {
    return __awaiter(this, void 0, void 0, function* () {
        let res = yield fetch(url);
        return new Uint8Array(yield res.arrayBuffer());
    });
}
function getLanguages() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Getting list of supported languages...");
        return yield fetchJson("http://tech.lds.org/glweb?action=languages.query&format=json");
    });
}
function getCatalog() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Checking for catalog update...");
        let update = yield fetchJson("http://tech.lds.org/glweb?action=catalog.query.modified&languageid=" +
            language + "&platformid=" + platform + "&format=json");
        let version = update.version;
        if (platform == localStorage.getItem("platform") &&
            language == localStorage.getItem("language") &&
            version == localStorage.getItem("version")) {
            console.log("No update, loading from cache.");
            return JSON.parse(localStorage.getItem("catalog"));
        }
        console.log("Updating catalog...");
        let result = yield fetchJson("http://tech.lds.org/glweb?action=catalog.query&languageid=" +
            language + "&platformid=" + platform + "&format=json");
        localStorage.setItem("catalog", JSON.stringify(result.catalog));
        localStorage.setItem("version", version);
        localStorage.setItem("language", language);
        localStorage.setItem("platform", platform);
        return result.catalog;
    });
}
function getZbook(book) {
    return __awaiter(this, void 0, void 0, function* () {
        let data = yield fetchBinary(book.url);
        console.log(data);
        data = pako_1.inflate(data);
        console.log(data);
        return new sql_js_1.Database(data);
    });
}
window.onload = function () {
    return __awaiter(this, void 0, void 0, function* () {
        let langs = yield getLanguages();
        let catalog = yield getCatalog();
        let folder = catalog.folders[0];
        console.log("folder", folder);
        let book = folder.books[0];
        console.log("book", book);
        let db = yield getZbook(book);
        console.log(db);
        let res = db.exec("SELECT * FROM nodes WHERE content IS NOT NULL LIMIT 5")[0];
        console.log(res);
        res.values.forEach(function (row) {
            let obj = {};
            res.columns.forEach(function (col, i) {
                obj[col] = row[i];
            });
            console.log(obj);
            document.write(obj.content + obj.refs);
        });
        console.log(res);
    });
};
//# sourceMappingURL=app.js.map