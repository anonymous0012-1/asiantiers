const base = require('./setuptierroles');
const aliasData = {
    name: 'setuptierrole',
    toJSON() {
        const json = base.data.toJSON();
        json.name = 'setuptierrole';
        return json;
    }
};
module.exports = {
    data: aliasData,
    execute: base.execute
};