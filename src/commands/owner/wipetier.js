const base = require('./wipetiers');
const aliasData = {
    name: 'wipetier',
    toJSON() {
        const json = base.data.toJSON();
        json.name = 'wipetier';
        return json;
    }
};
module.exports = {
    data: aliasData,
    execute: base.execute
};