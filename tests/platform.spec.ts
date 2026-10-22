import { test, expect, type Page } from "@playwright/test";

async function start(page: Page, game: string, practice = false) {
  await page.goto(`/play/${game}`);
  await page
    .getByRole("button", {
      name: practice ? "Try a practice round" : "Start assessment",
      exact: true,
    })
    .click();
  await page.locator(".round-line").waitFor();
}
async function finishSignal(page: Page, practice = false) {
  for (let round = 0; round < (practice ? 3 : 12); round++) {
    while (await page.locator(".signal-arena.wait").count())
      await page.clock.runFor(100);
    await expect(page.locator(".signal-arena.go")).toBeVisible();
    await page.clock.runFor(180);
    await page.keyboard.press("Space");
    await expect(page.locator(".signal-arena.feedback")).toBeVisible();
    await page.clock.runFor(700);
  }
}

test("discovery, catalog filters, methodology and responsive navigation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "There’s more to you." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "All 12 games", exact: true }).click();
  await expect(page.locator(".game-card")).toHaveCount(12);
  await page.getByRole("button", { name: "Memory", exact: true }).click();
  await expect(page.locator(".game-card")).toHaveCount(2);
  await page.getByRole("button", { name: /All games/ }).click();
  await page.getByRole("textbox", { name: "Search games" }).fill("orbit");
  await expect(page.locator(".game-card")).toHaveCount(1);
  await page
    .getByRole("textbox", { name: "Search games" })
    .fill("does not exist");
  await expect(
    page.getByRole("heading", { name: "No games found." }),
  ).toBeVisible();
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "/",
      "/games",
      "/profile",
      "/challenges",
      "/settings",
      "/methodology",
      "/play/signal",
    ]) {
      await page.goto(route);
      await page.locator("main").waitFor();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${route} at ${width}px`,
      ).toBe(true);
    }
  }
  expect(errors).toEqual([]);
});

test("Signal completes, persists on reload, updates profile, exports and restores", async ({
  page,
}) => {
  await page.clock.install();
  await start(page, "signal");
  await finishSignal(page);
  await expect(page).toHaveURL(/\/results\//);
  await expect(
    page.getByText("Saved to this browser", { exact: true }),
  ).toBeVisible();
  const recorded = await page.locator(".result-number").innerText();
  expect(parseFloat(recorded)).toBeGreaterThanOrEqual(150);
  expect(parseFloat(recorded)).toBeLessThan(450);
  const url = page.url();
  await page.reload();
  await expect(page).toHaveURL(url);
  await expect(page.locator(".result-number")).toHaveText(recorded);
  await page.goto("/profile");
  await expect(page.getByText("First spark", { exact: true })).toBeVisible();
  await expect(page.locator(".stat-block").first()).toContainText("1");
  await page.goto("/settings");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export my data" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();
  await page
    .getByRole("button", { name: "Delete local data", exact: true })
    .click();
  await page.getByRole("button", { name: "Yes, delete local data" }).click();
  await expect(
    page.getByText("Local history and preferences deleted."),
  ).toBeVisible();
  await page.getByLabel("Import a backup").setInputFiles(path!);
  await expect(
    page.getByText(/Backup validated. 1 sessions processed/),
  ).toBeVisible();
  await page.goto(url);
  await expect(page.locator(".result-number")).toHaveText(recorded);
});

test("practice is interactive and does not alter assessment history", async ({
  page,
}) => {
  await page.clock.install();
  await start(page, "signal", true);
  await finishSignal(page, true);
  await expect(
    page.getByRole("heading", { name: "You’ve got the idea." }),
  ).toBeVisible();
  await page.goto("/profile");
  await expect(page.locator(".stat-block").first()).toContainText("0");
});

test("early responses consume trials; restart cleans up pending events; resizing interrupts", async ({
  page,
}) => {
  await page.clock.install();
  await start(page, "signal");
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("heading", { name: "A little too soon" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "End session" }).click();
  await expect(
    page.getByRole("heading", { name: "A fresh start?" }),
  ).toBeVisible();
  await page.clock.runFor(10000);
  await expect(
    page.getByRole("heading", { name: "A fresh start?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page.setViewportSize({ width: 900, height: 700 });
  await expect(
    page.getByText("The arena size changed. Start again with the new layout."),
  ).toBeVisible();
});

for (const game of [
  "crossroads",
  "color-conflict",
  "rule-shift",
  "pattern-forge",
  "rotation-lab",
]) {
  test(`${game}: full assessment reaches a recorded result`, async ({
    page,
  }) => {
    await page.clock.install();
    await start(page, game);
    const count =
      game === "crossroads"
        ? 30
        : game === "pattern-forge"
          ? 12
          : game === "rotation-lab"
            ? 16
            : 40;
    for (let index = 0; index < count; index++) {
      const answer = page.locator(".answer-button").first();
      await expect(answer).toBeEnabled();
      await page.clock.runFor(160);
      await answer.click();
      await page.clock.runFor(750);
    }
    await expect(page).toHaveURL(/\/results\//);
    await expect(page.locator(".result-main")).toContainText(
      "Local assessment",
    );
    await expect(page.locator(".result-number")).not.toBeEmpty();
  });
}

for (const game of ["symbol-match", "math-sprint"]) {
  test(`${game}: timed assessment completes even without a response`, async ({
    page,
  }) => {
    await page.clock.install();
    await start(page, game);
    await page.clock.runFor(46000);
    await expect(page).toHaveURL(/\/results\//);
    await expect(page.locator(".result-number")).toContainText("0.0");
  });
}

test("Grid Recall accepts remembered cells and saves a full staircase", async ({
  page,
}) => {
  await page.clock.install();
  await start(page, "grid-recall");
  for (let round = 0; round < 12; round++) {
    await expect(
      page.getByText("Watch closely", { exact: true }),
    ).toBeVisible();
    const pattern = await page
      .locator(".memory-grid button.lit")
      .evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("aria-label")!),
      );
    expect(pattern.length).toBeGreaterThan(0);
    await page.clock.runFor(3000);
    await expect(page.getByText("Rebuild the constellation")).toBeVisible();
    for (const cell of pattern)
      await page.getByRole("button", { name: cell, exact: true }).click();
    await page.getByRole("button", { name: /Submit .* cells/ }).click();
    await expect(page.getByText("Exactly right")).toBeVisible();
    await page.clock.runFor(1200);
  }
  await expect(page).toHaveURL(/\/results\//);
  await expect(
    page.locator(".metric-card").filter({ hasText: "Recall accuracy" }),
  ).toContainText("100%");
});

test("Echo Path is playable and completes all rounds, including timeouts", async ({
  page,
}) => {
  await page.clock.install();
  await start(page, "echo-path");
  await page.clock.runFor(240000);
  await expect(page).toHaveURL(/\/results\//);
  await expect(page.locator(".result-main")).toBeVisible();
});

test("Target Burst acquires visible targets with pointer input", async ({
  page,
}) => {
  await page.clock.install();
  await start(page, "target-burst");
  for (let index = 0; index < 30; index++) {
    await page.clock.runFor(200);
    const target = await page.locator(".precision-target").boundingBox();
    expect(target).toBeTruthy();
    await page.mouse.click(
      target!.x + target!.width / 2,
      target!.y + target!.height / 2,
    );
    await page.clock.runFor(200);
  }
  await expect(page).toHaveURL(/\/results\//);
  await expect(
    page.locator(".metric-card").filter({ hasText: "Hit rate" }),
  ).toContainText("100%");
});

test("Orbit Track completes a timed recording and scores missing input as off target", async ({
  page,
}) => {
  await page.clock.install();
  await start(page, "orbit-track");
  await page.clock.runFor(46000);
  await expect(page).toHaveURL(/\/results\//);
  await expect(page.locator(".result-number")).toContainText("0");
  await expect(
    page.locator(".metric-card").filter({ hasText: "Tracked time" }),
  ).toContainText("45.0 s");
});

test("settings persist, themes work, invalid imports preserve history", async ({
  page,
}) => {
  await page.goto("/settings");
  await page.getByLabel("Explorer name").fill("Ada");
  await page.getByRole("button", { name: "Save name" }).click();
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await page.getByLabel("Reduce decorative motion").check();
  await page.reload();
  await expect(page.getByLabel("Explorer name")).toHaveValue("Ada");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
  await page
    .getByLabel("Import a backup")
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"format":"other"}'),
    });
  await expect(page.getByRole("alert")).toContainText(
    "not a supported HumanRank backup",
  );
  await expect(page.getByLabel("Explorer name")).toHaveValue("Ada");
});
