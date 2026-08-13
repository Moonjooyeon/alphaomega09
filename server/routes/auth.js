const express = require("express");
const config = require("../config");
const { makeToken, requireUser } = require("../services/auth");
const { loginWithToss } = require("../services/toss");
const { publicUser, upsertLoginUser } = require("../services/users");
const { jsonError } = require("../utils");

const router = express.Router();

function displayNameForTossUser(userKey) {
  return `토스 사용자 ${String(userKey).slice(-4)}`;
}

router.post("/toss/login", async (req, res) => {
  const { authorizationCode = "", referrer = "", mockUserKey = "" } = req.body || {};
  if (!authorizationCode && !config.toss.loginMock) {
    res.status(400).json(jsonError("authorizationCode가 필요합니다."));
    return;
  }

  try {
    const tossUser = config.toss.loginMock
      ? { userKey: String(mockUserKey || "local-dev-user"), raw: { mock: true } }
      : await loginWithToss({ authorizationCode, referrer });
    const user = await upsertLoginUser({
      loginId: `toss:${tossUser.userKey}`,
      displayName: displayNameForTossUser(tossUser.userKey),
    });

    res.json({
      user: publicUser(user),
      token: makeToken(user),
      tossUserKey: tossUser.userKey,
    });
  } catch (error) {
    res.status(error.status || 500).json(jsonError(error.message || "Toss 로그인에 실패했습니다."));
  }
});

router.get("/me", async (req, res) => {
  try {
    const user = await requireUser(req);
    res.json({ user: publicUser(user) });
  } catch (error) {
    res.status(error.status || 401).json(jsonError(error.message || "로그인이 필요합니다."));
  }
});

module.exports = router;
