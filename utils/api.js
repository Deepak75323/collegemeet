module.exports.wantsJson = function (req) {
  return (
    req.xhr ||
    req.get("X-Requested-With") === "XMLHttpRequest" ||
    (req.headers.accept && req.headers.accept.indexOf("application/json") !== -1)
  );
};
