# HumanRank measurement and statistical design research

Research date: October 21, 2026. This is a planning document, not a claim that the proposed measures have been validated. Sources establish browser behavior and statistical methods; recommendations below are HumanRank design proposals requiring pilot data.

## 1. What browser games can measure

Use `performance.now()` for elapsed time. Its clock is monotonic and independent of wall-clock adjustments; timer resolution can be reduced for privacy. Sub-millisecond timestamp resolution does not establish sub-millisecond experimental accuracy. Keep wall-clock timestamps separately for history. [W3C High Resolution Time](https://www.w3.org/TR/hr-time/)

Schedule visual stimulus changes inside `requestAnimationFrame`, synchronously update the actual gameplay surface, and capture both the supplied frame timestamp and `performance.now()` at the update. Animation callbacks precede subsequent rendering steps, so neither timestamp is a measurement of the instant light reaches the player. Hidden documents are filtered from rendering updates. [WHATWG rendering processing model](https://html.spec.whatwg.org/multipage/webappapis.html#update-the-rendering)

Record native input `event.timeStamp` and handler-entry time. The DOM specification defines event timestamps and distinguishes user-agent-dispatched events from events dispatched by scripts. A trusted-event flag is not an anti-cheat proof. [WHATWG DOM events](https://dom.spec.whatwg.org/#interface-event)

**Implementation proposal:** isolate a small timing kernel from framework rendering. Use an explicit trial state machine, preload assets, reject inputs before the stimulus, ignore repeated keyboard events, and accept only one response per trial. Align visual changes with animation frames rather than starting a clock when a timer was requested. Store stimulus, event, and handler times, input modality, frame gaps, visibility interruptions, and protocol version. A large dispatch delay should flag a trial instead of being silently subtracted from the score. Verify timestamp origins in supported browsers; quarantine incompatible measurements.

Invalidate an active assessment on `visibilitychange`; practice may resume with a fresh trial, preserving an interruption count. Window blur is an additional signal, not equivalent to document invisibility. The product plan conservatively ends assessment eligibility on relevant focus loss as well. The Page Visibility specification exposes both state and change events. [W3C Page Visibility](https://www.w3.org/TR/page-visibility-2/)

Measurements include device, display, operating-system, and browser effects. Do not subtract a guessed universal hardware offset. Label reaction results as browser-measured response time, compare matched protocols and input groups, and recommend the same setup for personal trends. Automated tests can establish clock handling and game correctness, but true visual latency accuracy needs external hardware measurements.

## 2. Audio requires a separate protocol

Web Audio distinguishes processing latency (`baseLatency`) from estimated hardware output latency (`outputLatency`). `getOutputTimestamp()` maps audio stream positions to an estimated performance-clock time. The specification describes cumulative latency from several sources, including input/output devices and buffering. These values do not provide a universal correction for every player's audible stimulus. [W3C Web Audio](https://www.w3.org/TR/webaudio-1.0/)

**Recommendation:** defer audio reaction from the initial ranked battery. An eventual audio game should start only after an explicit user gesture, pre-initialize its audio context, verify supported timing APIs, and report its protocol separately from visual reaction. Bluetooth and wired output should not silently share a tightly interpreted distribution. Audio can still provide optional feedback after a scored response without determining the measurement.

## 3. Individual metrics and repeatability

**Proposed measurement rules:** retain raw trials and derive game-specific summaries with pure functions. For reaction games, report median correct response time, interquartile range, valid-trial count, misses, and false starts. For choice games, retain accuracy beside latency; a fast incorrect response must not improve a rating. For memory, retain difficulty, opportunities, correct responses, and highest reliably completed level, rather than only a single lucky maximum. For precision, retain hit rate and acquisition time together. For timed processing games, use net correct throughput with a published error rule.

Use a fixed ranked protocol with familiarization, trial count or duration, difficulty schedule, and stopping rules. Creative variants may use the same engine but must have separate protocol identifiers. Stop ranked sessions after a predefined false-start or interruption limit so repeated restarts cannot invisibly cherry-pick successful trials. Keep practice unlimited; do not claim that participation experience points measure ability.

Distinguish within-session variation from between-session reliability. Initially show descriptive variation and attempt counts. Do not invent a confidence interval for latent ability from a handful of autocorrelated trials. Pilot repeated sessions across days before choosing reliability thresholds and minimum trial counts.

## 4. Percentiles and cohort integrity

Percentile definitions differ in how they handle ties. SciPy documents strict, weak, rank, and mean conventions; they are not interchangeable for discrete memory levels. [SciPy percentileofscore](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.percentileofscore.html)

**Proposal:** orient each metric so higher means better, then use the mid-distribution percentile:

`p = (number of reference players below x + 0.5 × number tied with x) / N`.

Say “percentile among qualifying HumanRank players” rather than “better than p% of humans.” “Faster than” should use the strict faster count rather than treating ties as wins. Show cohort definition, distinct-player count, protocol version, snapshot date, and data status. Never substitute number of attempts for number of independent players.

Define a player's reference contribution before collecting data: for example, a median of a fixed number of standardized sessions in a stated window. Keep personal bests separate. One player contributes one aggregate per game/cohort snapshot. More attempts must not multiply their statistical weight. Anonymous local records cannot establish unique real-world identity; even accounts cannot eliminate multiple-account abuse. This limitation belongs in methodology, not hidden behind the word “verified.”

Reference sets should exclude the evaluated player, or use a prior frozen cohort that does not include their evaluated result. Use stable snapshots so ordinary play does not move comparison targets unpredictably. A change in norms must not overwrite historic raw scores.

For a fixed threshold, the proportion of independent reference players below it can have a binomial interval. Wilson or exact methods avoid some failures of the simple symmetric normal approximation, especially near the tails. [NIST proportion confidence intervals](https://www.itl.nist.gov/div898/handbook/prc/section2/prc241.htm)

For tied mid-ranks and estimated player aggregates, use player-level resampling of the complete calculation; do not present a binomial interval as if it covered all sources of uncertainty. Intervals address sampling variability under their assumptions, not self-selection or cheating. Start with broad comparison bands, then enable finer percentiles only after precision and stability checks. Any minimum sample threshold is a product release gate, not a universal scientific law.

## 5. Category and overall ratings

**Design choice:** one designated anchor protocol per category would minimize assessment burden. The implementation plan instead proposes two fixed anchor games per category for broader coverage, with a six-game introductory circuit producing only an initial partial profile. Both options need reliability analysis; neither is established by the cited sources. Additional games must not make category scores depend on arbitrary game availability. Introducing or reweighting a rated game creates a new rating version.

Normalize anchor measurements against actual reference distributions, with an explicitly documented treatment of ties and tails. Compute a transparent equal-category-weighted composite. If using normal-score transforms, clip extreme empirical probabilities at a sample-dependent plotting-position boundary so zero and one never become infinite. The average of six game percentiles is a composite score, not an overall population percentile. Calculate the latter by applying the same composite formula to comparable complete reference profiles and ranking within that distribution.

Do not fill missing categories with zero or average scores. Show coverage and available category results until the complete standardized battery exists. Before sufficient population data, show raw metrics, personal changes, and explicitly labeled game milestones; withhold population-derived overall ratings. Fixed design milestones may be useful, but they are not validated ability norms.

## 6. Profile rarity: separate level, shape, and similarity

**Recommended product distinction:** overall rank describes stronger performance; shape unusualness describes a less typical balance of categories. A high performer can have a common shape, and an average performer can have an unusual balance. Neither establishes intelligence, health, or human worth.

Start with a complete six-category vector under one compatible protocol. Normalize with a frozen training reference. Remove the overall level to analyze balance. Six mean-centered coordinates sum to zero, making their covariance singular; represent them with five orthonormal contrasts. Fit a regularized covariance model and compute a covariance-aware distance. Shrinkage is an established way to improve poorly conditioned covariance estimates; it does not by itself prove a Gaussian model fits these games. [Ledoit and Wolf, 2004](https://doi.org/10.1016/S0047-259X%2803%2900096-4)

Reserve different players for calibration. Rank held-out distances empirically rather than assuming a chi-square tail. Split-conformal outlier methods provide a principled framework for calibration under appropriate sampling assumptions, but validity does not survive arbitrary population mismatch. [Bates et al., 2023](https://doi.org/10.1214/22-AOS2244)

The proposed conservative tail score is `(1 + calibration distances at least as large as this distance) / (N_calibration + 1)`. Communicate this as unusualness relative to the reference cohort. It is **not** the fraction of players with matching profiles, nor a justification for saying “your profile occurs 1 in X.” Assess drift, repeat-session stability, outliers, and subgroup miscalibration. If the joint distribution is strongly multimodal, compare a neighborhood method on held-out data before selecting a model.

For actual similarity frequency, define a meaningful neighborhood in advance, freeze it independently of the evaluation cohort, and count matches in a separate holdout. State the tolerance: exact continuous profiles have no useful occurrence frequency. Consider “1 in X” only after adequate match counts, stable intervals, and repeatability; show a range and the definition. No matches means insufficient evidence, not infinite rarity. Do not multiply category percentiles or report the reciprocal of an anomaly tail as match prevalence.

## 7. Required validation before release

Use deterministic unit tests for scoring, directionality, ties, missing values, duplicate submissions, incompatible versions, and state transitions. Test that repeated attempts cannot add population weight. Use simulations with known correlated distributions to check aggregate and rarity calibration, then pilot real repeated sessions to evaluate reliability and device effects. Separate participants across model fitting, calibration, and evaluation, including all sessions from the same person in only one split. Keep simulated data visibly confined to tests and development.

Browser automation should exercise premature input, tab changes, repeated keys, rapid taps, resizing, touch interaction, reduced motion, and cleanup after navigation. Review real devices as well: emulated touch and headless clocks do not validate physical timing accuracy. Ship unavailable/provisional states as complete product behavior; never fill insufficient-data screens with invented comparison numbers.
