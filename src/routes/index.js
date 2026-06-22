import express from "express";
import userRouter from "./user.route.js";
import loginRouter from "./login.route.js";
import registerRouter from "./register.route.js";
import projectRouter from "./project.route.js";
import articleRouter from "./article.route.js";
import googleRouter from "./google.route.js";
import zoneRouter from "./zone.route.js";
import keywordRouter from "./keyword.route.js";
import catalogRouter from "./catalog.route.js";
import authorRouter from "./author.route.js";
import topicRouter from "./topic.route.js";
import journalRouter from "./journal.route.js";
import volumeRouter from "./volume.route.js";
import issueRouter from "./issue.route.js";
import authRouter from "./auth.route.js";
import subjectAreaRouter from "./subjectArea.route.js";
import subjectCategoryRouter from "./subjectCategory.route.js";
import searchRotuer from "./search.route.js";

const router = express.Router();

// Gom router của user vào đường dẫn /users
router.use("/users", userRouter);
router.use("/projects", projectRouter);
router.use("/zones", zoneRouter);
router.use("/catalog", catalogRouter);

// Gom router của login, register và google vào đường dẫn /auth
router.use("/auth", loginRouter);
router.use("/auth", registerRouter);
router.use("/auth", googleRouter);
router.use("/auth", authRouter);

// Gom router của article vào đường dẫn /articles
router.use("/articles", articleRouter);

// Gom router của keyword vào đường dẫn /projects
router.use("/projects", keywordRouter);

router.use("/author", authorRouter);

// Gom router của topic vào đường dẫn /topics
router.use("/topics", topicRouter);

router.use("/keywords", keywordRouter);
router.use("/journal", journalRouter);
router.use("/volumes", volumeRouter);
router.use("/subject-areas", subjectAreaRouter);
router.use("/subject-categories", subjectCategoryRouter);
router.use("/issues", issueRouter);

router.use("/search", searchRotuer);

export default router;
