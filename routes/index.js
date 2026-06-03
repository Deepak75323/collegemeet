const express = require("express");
const router = express.Router();
const passport = require("passport");
const homecontrollers = require("../controllers/home__controllers");
const fetch = require("node-fetch");

router.get("/", passport.checkAuthentication, homecontrollers.home);

router.get("/about/:id", homecontrollers.about);

router.post(
  "/update/:id",
  passport.checkAuthentication,
  homecontrollers.update
);

router.get("/skills", homecontrollers.skills);
router.use("/posts", require("./post"));
router.use("/comments", require("./comments"));
router.use("/likes", require("./likes"));

router.get("/qualification", homecontrollers.qualification);

router.get(
  "/contact",
  passport.checkAuthentication,
  homecontrollers.contact
);
router.get("/signin", homecontrollers.signin);
router.get("/signup", homecontrollers.signup);

router.post("/create", homecontrollers.create);

router.post(
  "/createsession",
  passport.authenticate("local", { failureRedirect: "/signin" }),
  homecontrollers.createSession
);

router.get(
  "/users/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.post(
  "/thankyou",
  passport.checkAuthentication,
  homecontrollers.form
);

router.get("/room", passport.checkAuthentication, homecontrollers.room);
router.get("/enterroom", passport.checkAuthentication, homecontrollers.enterroom);
router.get(
  "/privateroom",
  passport.checkAuthentication,
  homecontrollers.privateroom
);

router.get("/work", homecontrollers.work);

router.get(
  "/users/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/signin" }),
  homecontrollers.createSession
);

router.get("/signout", homecontrollers.destroySession);

// ── Code execution via Wandbox API (free, no key needed) ─────────────────────
router.post("/api/run", passport.checkAuthentication, async (req, res) => {
    const { language, code } = req.body;
    if ( !language || code === undefined ) {
        return res.status(400).json({ error: "language and code are required" });
    }

    // Maps our language IDs → Wandbox compiler names
    const WANDBOX_COMPILER = {
        python:     "cpython-3.12.7",
        java:       "openjdk-jdk-22+36",
        cpp:        "gcc-head",
        c:          "gcc-head-c",
        javascript: "nodejs-20.17.0",
        typescript: "typescript-5.6.2",
        rust:       "rust-1.82.0",
        go:         "go-1.23.2",
    };

    const compiler = WANDBOX_COMPILER[language];
    if ( !compiler ) {
        return res.json({ output: `▶ "${language}" cannot be executed here.` });
    }

    try {
        const wandRes = await fetch("https://wandbox.org/api/compile.json", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ compiler, code }),
        });

        if ( !wandRes.ok ) {
            const text = await wandRes.text();
            return res.status(502).json({ error: "Compiler error: " + text });
        }

        const data = await wandRes.json();
        const parts = [
            data.compiler_error,
            data.program_output,
            data.program_error,
        ].filter( Boolean );

        const output = parts.join("\n") || "(no output)";
        const exitCode = data.status != null ? parseInt( data.status, 10 ) : null;
        return res.json({ output, exitCode });
    } catch ( err ) {
        return res.status(502).json({ error: "Could not reach compiler: " + err.message });
    }
});

router.get(
  "/userprofile",
  passport.checkAuthentication,
  homecontrollers.userprofile
);

module.exports = router;
