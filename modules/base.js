function getModule(cartridge, path) {
    var modulePath = dw.web.Resource.msgf('base.' + cartridge, '_preferences', '', path);
    return !empty(modulePath) ? require(modulePath) : null;
};

module.exports.getCore = function (path) {
    return getModule('core', path);
};

module.exports.get = function (path) {
    return getModule('controllers', path);
};
