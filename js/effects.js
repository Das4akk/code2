class PartnerBondEngine {
  static MOMENT_LABELS = {
    union: "Стались парой",
    kiss: "Поцелуй",
    checkin: "Отметка дня",
    milestone: "Веха",
  };

  static dateKey(ts = Date.now()) {
    return new Date(ts).toISOString().slice(0, 10);
  }

  static pairKey(uidA, uidB) {
    return [uidA, uidB].sort().join("__");
  }

  static bondRef(uidA, uidB) {
    return ref(db, `bonds/${this.pairKey(uidA, uidB)}`);
  }

  static async getBond(uidA, uidB) {
    if (!uidA || !uidB)
      return {
        totalWarmth: 0,
        streak: 0,
        lastStreakKey: "",
        moments: {},
        daily: {},
        checkins: {},
      };
    const snap = await get(this.bondRef(uidA, uidB));
    const raw = snap.val() || {};
    return {
      totalWarmth: Number(raw.totalWarmth || 0),
      streak: Number(raw.streak || 0),
      lastStreakKey: raw.lastStreakKey || "",
      moments: raw.moments || {},
      daily: raw.daily || {},
      checkins: raw.checkins || {},
    };
  }

  static yesterdayKey() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return this.dateKey(d.getTime());
  }

  static calcStreak(bond, dateKey = this.dateKey()) {
    const last = bond.lastStreakKey || "";
    if (last === dateKey) return bond.streak || 1;
    if (last === this.yesterdayKey()) return (bond.streak || 0) + 1;
    return 1;
  }

  static bondLevel(totalWarmth = 0) {
    return Math.max(1, Math.floor(totalWarmth / 120) + 1);
  }

  static levelProgress(totalWarmth = 0) {
    return Math.round(((totalWarmth % 120) / 120) * 100);
  }

  static async saveBond(uidA, uidB, bond) {
    await set(this.bondRef(uidA, uidB), {
      totalWarmth: bond.totalWarmth,
      streak: bond.streak,
      lastStreakKey: bond.lastStreakKey,
      moments: bond.moments,
      daily: bond.daily,
      checkins: bond.checkins,
      updatedAt: Date.now(),
    });
  }

  static async recordMoment(uidA, uidB, type, extra = {}) {
    if (!uidA || !uidB || String(uidB).startsWith("custom_partner_"))
      return null;
    const bond = await this.getBond(uidA, uidB);
    const dateKey = this.dateKey();
    const momentId = Utils.generateCryptoId(10);
    const label = extra.label || this.MOMENT_LABELS[type] || "Момент";
    const moment = {
      type,
      label,
      ts: extra.ts || Date.now(),
      fromUid: extra.fromUid || uidA,
    };
    bond.moments = bond.moments || {};
    bond.moments[momentId] = moment;
    if (extra.checkinKey) {
      bond.checkins = bond.checkins || {};
      bond.checkins[extra.checkinKey] = true;
    }

    const daily = bond.daily?.[dateKey] || { warmth: 0, moments: 0 };
    const warmthGain = Number(
      extra.warmth ||
        (type === "kiss"
          ? 8
          : type === "checkin"
            ? 12
            : type === "union"
              ? 25
              : 5),
    );
    daily.warmth = Math.min(100, Number(daily.warmth || 0) + warmthGain);
    daily.moments = Number(daily.moments || 0) + 1;
    bond.daily = bond.daily || {};
    bond.daily[dateKey] = daily;
    bond.totalWarmth = Number(bond.totalWarmth || 0) + warmthGain;
    bond.streak = this.calcStreak(bond, dateKey);
    bond.lastStreakKey = dateKey;

    await this.saveBond(uidA, uidB, bond);
    return bond;
  }

  static async onUnion(uidA, uidB, sinceTs = Date.now()) {
    await this.recordMoment(uidA, uidB, "union", {
      label: "Стались парой 💞",
      warmth: 30,
      ts: sinceTs,
    });
  }

  static async sendKiss(fromUid, partnerUid) {
    return this.recordMoment(fromUid, partnerUid, "kiss", {
      fromUid,
      label: "Воздушный поцелуй 💋",
      warmth: 10,
    });
  }

  static async dailyCheckin(uid, partnerUid) {
    const dateKey = this.dateKey();
    const checkinKey = `${dateKey}_${uid}`;
    const bond = await this.getBond(uid, partnerUid);
    if (bond.checkins?.[checkinKey]) return { ok: false, reason: "already" };
    await this.recordMoment(uid, partnerUid, "checkin", {
      fromUid: uid,
      label:
        'Отметили день вместе <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Activity/Sparkles.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;">',
      warmth: 14,
      checkinKey,
    });
    return { ok: true };
  }

  static canCheckinToday(bond, uid) {
    return !bond.checkins?.[`${this.dateKey()}_${uid}`];
  }

  static buildTrailDays(sinceTs, bond) {
    const days = [];
    const cursor = new Date(sinceTs || Date.now());
    cursor.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const momentsList = Object.values(bond.moments || {}).sort(
      (a, b) => a.ts - b.ts,
    );

    for (let d = new Date(cursor); d <= end; d.setDate(d.getDate() + 1)) {
      const key = this.dateKey(d.getTime());
      const row = bond.daily?.[key] || {};
      const dayMoments = momentsList.filter((m) => this.dateKey(m.ts) === key);
      const lastMoment = dayMoments[dayMoments.length - 1];
      days.push({
        key,
        label: d.toLocaleDateString("ru-RU", {
          day: "numeric",
          month: "short",
        }),
        weekday: d.toLocaleDateString("ru-RU", { weekday: "short" }),
        warmth: Number(row.warmth || 0),
        momentsCount: Number(row.moments || dayMoments.length),
        lastMomentLabel: lastMoment?.label || "",
        isToday: key === this.dateKey(),
      });
    }
    return days;
  }
}

class PartnerRelationshipPanel {
  static milestones = [7, 30, 100, 365];
  static lastContext = null;

  static async open(ownerUid, partnerUid, myProf, theirProf, sinceTs) {
    const root = Utils.$("partner-ambilight-root");
    const modal = Utils.$("modal-partner-view");
    if (!root || !modal) return;

    const myUid = AppState.currentUser?.uid || ownerUid;
    const daysTogether = sinceTs
      ? Math.max(1, Math.ceil((Date.now() - sinceTs) / 86400000))
      : 1;
    const sinceText = sinceTs
      ? new Date(sinceTs).toLocaleDateString("ru-RU")
      : "недавно";

    let bond = await PartnerBondEngine.getBond(myUid, partnerUid);
    if (
      sinceTs &&
      daysTogether >= 7 &&
      Object.keys(bond.moments || {}).length === 0
    ) {
      await PartnerBondEngine.onUnion(myUid, partnerUid, sinceTs);
      bond = await PartnerBondEngine.getBond(myUid, partnerUid);
    }

    const trailDays = PartnerBondEngine.buildTrailDays(
      sinceTs || Date.now(),
      bond,
    );
    const level = PartnerBondEngine.bondLevel(bond.totalWarmth);
    const levelPct = PartnerBondEngine.levelProgress(bond.totalWarmth);
    const warmthFill = Math.min(
      100,
      Math.round((bond.totalWarmth % 120) / 1.2) ||
        trailDays[trailDays.length - 1]?.warmth ||
        0,
    );
    const momentsTotal = Object.keys(bond.moments || {}).length;
    const nextMilestone =
      this.milestones.find((m) => m > daysTogether) ||
      this.milestones[this.milestones.length - 1];
    const milestoneProgress = Math.min(
      100,
      Math.round((daysTogether / nextMilestone) * 100),
    );
    const canCheckin = PartnerBondEngine.canCheckinToday(bond, myUid);

    this.lastContext = {
      ownerUid,
      partnerUid,
      myUid,
      myProf,
      theirProf,
      sinceTs,
    };

    const pathMarkup = this.buildZigzagMarkup(trailDays, daysTogether);
    root.innerHTML = `
            <div class="partner-ambilight-panel" style="--together-pct:${warmthFill};">
                <div class="partner-ambilight-glow" aria-hidden="true"></div>
                <div class="partner-ambilight-shine" aria-hidden="true"></div>
                <header class="partner-ambilight-header">
                    <div class="partner-ambilight-couple">
                        <div class="partner-ambilight-avatar heartbeat" id="partner-modal-my-avatar"></div>
                        <div class="partner-ambilight-link" aria-hidden="true">
                            <span class="partner-link-pulse"></span>
                            <span class="partner-link-icon">💞</span>
                        </div>
                        <div class="partner-ambilight-avatar heartbeat" id="partner-modal-their-avatar"></div>
                    </div>
                    <div class="partner-ambilight-titles">
                        <h2 id="partner-modal-names">${Utils.escapeHtml(myProf.name)} & ${Utils.escapeHtml(theirProf.name)}</h2>
                        <p id="partner-modal-stats">Уровень ${level} · ${daysTogether} дн. вместе · с ${sinceText}</p>
                    </div>
                </header>
                <section class="partner-ambilight-metrics">
                    <div class="partner-metric-ring" title="Прогресс до следующего уровня связи">
                        <svg viewBox="0 0 72 72">
                            <defs><linearGradient id="partnerRingGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ff9fd4"/><stop offset="100%" stop-color="#9eb8ff"/></linearGradient></defs>
                            <circle cx="36" cy="36" r="30" class="ring-bg"/>
                            <circle cx="36" cy="36" r="30" class="ring-val" style="stroke-dasharray:${levelPct * 1.885} 188.5"/>
                        </svg>
                        <div class="ring-label"><strong>${levelPct}%</strong><span>уровень</span></div>
                    </div>
                    <div class="partner-metric-card">
                        <span class="metric-label">Тепло связи</span>
                        <strong>${bond.totalWarmth} ✦</strong>
                    </div>
                    ${
                      bond.streak && bond.streak > 1
                        ? `
                    <div class="partner-metric-card">
                        <span class="metric-label">Серия дней</span>
                        <strong>${bond.streak} <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Animals%20and%20Nature/Fire.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;"></strong>
                    </div>
                    `
                        : ""
                    }
                    <div class="partner-metric-card milestone-card">
                        <span class="metric-label">Моментов · до ${nextMilestone} дн.</span>
                        <div class="milestone-bar"><span style="width:${milestoneProgress}%"></span></div>
                        <strong>${momentsTotal} · ${milestoneProgress}%</strong>
                    </div>
                </section>
                <section class="partner-path-section">
                    <div class="partner-path-head">
                        <span>Тропинка моментов</span>
                        <span class="partner-path-hint">тепло дня и события</span>
                    </div>
                    <div class="partner-path-scroll">${pathMarkup}</div>
                    <div class="partner-path-tooltip" id="partner-path-tooltip" hidden></div>
                </section>
                <footer class="partner-ambilight-footer">
                    <button type="button" class="partner-kiss-btn" id="btn-partner-modal-kiss">Поцелуй 💋</button>
                    <button type="button" class="partner-checkin-btn" id="btn-partner-checkin" ${canCheckin ? "" : "disabled"}>${canCheckin ? 'Отметить день <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Activity/Sparkles.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;">' : "День отмечен"}</button>
                    <button type="button" class="secondary-btn btn-close-modal">Закрыть</button>
                </footer>
            </div>
        `;

    Utils.$("partner-modal-my-avatar").innerHTML =
      ProfileManager.getAvatarHtml(myProf);
    Utils.$("partner-modal-their-avatar").innerHTML =
      ProfileManager.getAvatarHtml(theirProf);
    this.bindPathNodes();
    this.bindActions();
    modal.classList.add("active");
  }

  static buildZigzagMarkup(days, daysTogether = 1) {
    if (!days.length) {
      return '<div class="partner-path-empty">Отметьте день или отправьте поцелуй — тропинка оживёт</div>';
    }

    const padY = 24;
    const rowGap = 56;
    const colLeft = 42;
    const colRight = 258;
    const width = 300;
    const rows = Math.ceil(days.length / 2);
    const height = padY * 2 + Math.max(0, rows - 1) * rowGap + 20;

    const points = days.map((day, i) => {
      const row = Math.floor(i / 2);
      return {
        day,
        x: i % 2 === 0 ? colLeft : colRight,
        y: padY + row * rowGap,
      };
    });

    const pathD = points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
      .join(" ");
    const maxWarmth = Math.max(1, ...days.map((d) => d.warmth));
    const nodes = points
      .map((p, i) => {
        const intensity = 0.2 + (p.day.warmth / maxWarmth) * 0.8;
        const dayNum = i + 1;
        const isMilestone =
          this.milestones.includes(dayNum) ||
          this.milestones.includes(daysTogether - (days.length - 1 - i));
        return `
                <g class="partner-path-node ${p.day.isToday ? "is-today" : ""} ${isMilestone ? "is-milestone" : ""} ${p.day.warmth > 0 ? "has-warmth" : ""}"
                   data-warmth="${p.day.warmth}"
                   data-moments="${p.day.momentsCount}"
                   data-moment="${Utils.escapeHtml(p.day.lastMomentLabel || "")}"
                   data-label="${Utils.escapeHtml(p.day.label)}"
                   data-weekday="${Utils.escapeHtml(p.day.weekday)}"
                   style="--node-glow:${intensity}">
                    <circle class="node-halo" cx="${p.x}" cy="${p.y}" r="14"/>
                    <circle class="node-core" cx="${p.x}" cy="${p.y}" r="7"/>
                    ${isMilestone ? `<text class="node-star" x="${p.x}" y="${p.y - 18}" text-anchor="middle">✦</text>` : ""}
                </g>
            `;
      })
      .join("");

    return `
            <svg class="partner-zigzag-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMin meet">
                <defs>
                    <linearGradient id="partnerPathGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="rgba(255,143,198,0.9)"/>
                        <stop offset="50%" stop-color="rgba(186,130,255,0.75)"/>
                        <stop offset="100%" stop-color="rgba(120,210,255,0.85)"/>
                    </linearGradient>
                </defs>
                <path class="partner-path-line" d="${pathD}" fill="none" stroke="url(#partnerPathGrad)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                ${nodes}
            </svg>
        `;
  }

  static bindPathNodes() {
    const tooltip = Utils.$("partner-path-tooltip");
    const scroll = document.querySelector(".partner-path-scroll");
    if (!tooltip || !scroll) return;

    const showTip = (node, clientX, clientY) => {
      const warmth = Number(node.dataset.warmth || 0);
      const moments = Number(node.dataset.moments || 0);
      const moment = node.dataset.moment || "";
      const label = node.dataset.label || "";
      const weekday = node.dataset.weekday || "";
      tooltip.hidden = false;
      tooltip.innerHTML = `
                <strong>${Utils.escapeHtml(label)} · ${Utils.escapeHtml(weekday)}</strong>
                <span class="tip-warmth">Тепло дня: ${warmth}/100</span>
                <span class="tip-moments">Моментов: ${moments}</span>
                ${moment ? `<span class="tip-last">${Utils.escapeHtml(moment)}</span>` : '<span class="tip-last">Тихий день — добавьте поцелуй или отметку</span>'}
            `;
      const rect = scroll.getBoundingClientRect();
      tooltip.style.left = `${Math.min(Math.max(12, clientX - rect.left), rect.width - 180)}px`;
      tooltip.style.top = `${Math.max(8, clientY - rect.top - 88)}px`;
    };

    scroll.querySelectorAll(".partner-path-node").forEach((node) => {
      node.addEventListener("mouseenter", (e) =>
        showTip(node, e.clientX, e.clientY),
      );
      node.addEventListener("mousemove", (e) =>
        showTip(node, e.clientX, e.clientY),
      );
      node.addEventListener("mouseleave", () => {
        tooltip.hidden = true;
      });
      node.addEventListener("click", (e) => {
        scroll
          .querySelectorAll(".partner-path-node")
          .forEach((n) => n.classList.remove("is-pinned"));
        node.classList.add("is-pinned");
        showTip(node, e.clientX, e.clientY);
      });
    });
  }

  static bindActions() {
    const ctx = this.lastContext;
    if (!ctx) return;

    const kissBtn = Utils.$("btn-partner-modal-kiss");
    if (kissBtn) {
      kissBtn.onclick = async () => {
        const rect = kissBtn.getBoundingClientRect();
        for (let i = 0; i < 15; i++) {
          const heart = document.createElement("div");
          heart.innerText = ["💖", "💋", "💕", "💘"][
            Math.floor(Math.random() * 4)
          ];
          heart.style.cssText = `position:fixed;left:${rect.left + rect.width / 2 + (Math.random() - 0.5) * 50}px;top:${rect.top}px;font-size:${20 + Math.random() * 20}px;pointer-events:none;z-index:10000;transition:all 1.5s ease-out`;
          document.body.appendChild(heart);
          setTimeout(() => {
            heart.style.transform = `translateY(-${100 + Math.random() * 100}px) scale(1.5) rotate(${(Math.random() - 0.5) * 90}deg)`;
            heart.style.opacity = "0";
          }, 50);
          setTimeout(() => heart.remove(), 1600);
        }
        await PartnerBondEngine.sendKiss(ctx.myUid, ctx.partnerUid);
        Utils.toast("Поцелуй отправлен — связь стала теплее");
        await this.open(
          ctx.ownerUid,
          ctx.partnerUid,
          ctx.myProf,
          ctx.theirProf,
          ctx.sinceTs,
        );
      };
    }

    const checkinBtn = Utils.$("btn-partner-checkin");
    if (checkinBtn) {
      checkinBtn.onclick = async () => {
        const res = await PartnerBondEngine.dailyCheckin(
          ctx.myUid,
          ctx.partnerUid,
        );
        if (!res.ok)
          return Utils.toast("Вы уже отметили сегодняшний день", "info");
        Utils.toast("День отмечен — +тепло к связи");
        await this.open(
          ctx.ownerUid,
          ctx.partnerUid,
          ctx.myProf,
          ctx.theirProf,
          ctx.sinceTs,
        );
      };
    }
  }
}

class BackgroundFX {
  static init() {
    const canvas = Utils.$("particle-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
    let dots = [];
    let isTabVisible = true;
    let mouse = {
      x: null,
      y: null,
      radius: window.innerWidth < 768 ? 20 : 36,
      vx: 0,
      vy: 0,
    };
    let lastMouse = { x: null, y: null };
    let flashes = [];

    // Pre-bake high-performance offscreen sprites for GPU texture blitting
    function createOffscreenSprite(shapeType, size = 32, isDust = false) {
      const c = document.createElement("canvas");
      c.width = size;
      c.height = size;
      const sCtx = c.getContext("2d");
      const half = size / 2;

      sCtx.fillStyle = "#ffffff";
      sCtx.beginPath();
      if (shapeType === "square") {
        sCtx.rect(half * 0.3, half * 0.3, half * 1.4, half * 1.4);
      } else if (shapeType === "triangle") {
        sCtx.moveTo(half, half * 0.2);
        sCtx.lineTo(half + half * 0.8, half + half * 0.6);
        sCtx.lineTo(half - half * 0.8, half + half * 0.6);
        sCtx.closePath();
      } else {
        // Soft glowing circle
        const grad = sCtx.createRadialGradient(half, half, 0, half, half, half);
        grad.addColorStop(0, "rgba(255, 255, 255, 1)");
        grad.addColorStop(0.5, "rgba(235, 245, 255, 0.85)");
        grad.addColorStop(1, "rgba(210, 230, 255, 0)");
        sCtx.fillStyle = grad;
        sCtx.arc(half, half, half * 0.95, 0, Math.PI * 2);
      }
      sCtx.fill();
      return c;
    }

    const sprites = {
      circle: createOffscreenSprite("circle", 28, false),
      dustCircle: createOffscreenSprite("circle", 16, true),
      dustSquare: createOffscreenSprite("square", 16, true),
      dustTriangle: createOffscreenSprite("triangle", 16, true),
    };

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    window.addEventListener("resize", resize);
    resize();

    window.addEventListener("mousemove", (e) => {
      lastMouse.x = mouse.x;
      lastMouse.y = mouse.y;
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      if (lastMouse.x !== null) {
        mouse.vx = mouse.x - lastMouse.x;
        mouse.vy = mouse.y - lastMouse.y;
      }
    }, { passive: true });

    window.addEventListener("mouseout", () => {
      mouse.x = null;
      mouse.y = null;
      mouse.vx = 0;
      mouse.vy = 0;
    }, { passive: true });

    class Dot {
      constructor(isDust = false) {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;

        let angle = Math.random() * Math.PI * 2;
        let speed = Math.random() * 0.1 + (isDust ? 0.02 : 0.05);

        this.baseVx = Math.cos(angle) * speed;
        this.baseVy = Math.sin(angle) * speed;
        this.vx = this.baseVx;
        this.vy = this.baseVy;

        this.z = isDust ? Math.random() * 0.4 + 0.2 : Math.random() * 0.6 + 0.4;
        this.size = (Math.random() * 2 + 1) * this.z;
        this.isDust = isDust;

        // Pre-allocated typed arrays for trail history (0 GC allocations per frame)
        this.histX = new Float32Array(10);
        this.histY = new Float32Array(10);
        this.historyLen = 0;

        this.baseAlpha = isDust
          ? Math.random() * 0.3 + 0.1
          : Math.random() * 0.5 + 0.2;
        this.offset = Math.random() * 10000;
        this.parallaxX = 0;
        this.parallaxY = 0;
        this.grayLevel = isDust
          ? 175 + Math.random() * 35
          : 210 + Math.random() * 40;
        this.tint = isDust ? 0 : Math.random() * 0.08;
        this.isInteractive = !isDust || Math.random() > 0.4;
        this.shapeType = isDust
          ? Math.random() < 0.33
            ? "square"
            : Math.random() < 0.5
              ? "triangle"
              : "circle"
          : "circle";

        // Assign sprite
        if (!isDust) {
          this.sprite = sprites.circle;
        } else if (this.shapeType === "square") {
          this.sprite = sprites.dustSquare;
        } else if (this.shapeType === "triangle") {
          this.sprite = sprites.dustTriangle;
        } else {
          this.sprite = sprites.dustCircle;
        }
      }

      update(t) {
        this.vx += (this.baseVx - this.vx) * 0.05;
        this.vy += (this.baseVy - this.vy) * 0.05;

        this.x += this.vx * this.z;
        this.y += this.vy * this.z;

        if (this.x < 0) {
          this.x = 0;
          this.baseVx = Math.abs(this.baseVx);
          this.vx = Math.abs(this.vx);
        } else if (this.x > canvas.width) {
          this.x = canvas.width;
          this.baseVx = -Math.abs(this.baseVx);
          this.vx = -Math.abs(this.vx);
        }
        if (this.y < 0) {
          this.y = 0;
          this.baseVy = Math.abs(this.baseVy);
          this.vy = Math.abs(this.vy);
        } else if (this.y > canvas.height) {
          this.y = canvas.height;
          this.baseVy = -Math.abs(this.baseVy);
          this.vy = -Math.abs(this.vy);
        }

        if (mouse.x != null && this.isInteractive) {
          let cx = canvas.width * 0.5;
          let cy = canvas.height * 0.5;
          let px = (mouse.x - cx) * 0.05 * this.z;
          let py = (mouse.y - cy) * 0.05 * this.z;
          this.parallaxX += (px - this.parallaxX) * 0.1;
          this.parallaxY += (py - this.parallaxY) * 0.1;

          let dx = mouse.x - (this.x + this.parallaxX);
          let dy = mouse.y - (this.y + this.parallaxY);
          let distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < mouse.radius) {
            let force = (mouse.radius - distance) / mouse.radius;
            this.vx -= (dx / Math.max(distance, 1)) * force * 0.5 * this.z;
            this.vy -= (dy / Math.max(distance, 1)) * force * 0.5 * this.z;
          }
        }

        if (!this.isDust) {
          // Push to fixed Float32Array without array allocations
          const maxH = 9;
          const len = this.historyLen < maxH ? this.historyLen : maxH;
          for (let h = len; h > 0; h--) {
            this.histX[h] = this.histX[h - 1];
            this.histY[h] = this.histY[h - 1];
          }
          this.histX[0] = this.x + this.parallaxX;
          this.histY[0] = this.y + this.parallaxY;
          if (this.historyLen < 10) this.historyLen++;
        }
      }

      draw(ctx, t) {
        let drawX = this.x + this.parallaxX;
        let drawY = this.y + this.parallaxY;

        let twink = this.isDust
          ? Math.sin(t * 0.005 + this.offset) * 0.5 + 0.5
          : 1;
        let pulse = this.isDust
          ? 1
          : Math.sin(t * 0.003 + this.offset) * 0.5 + 0.5;
        let alpha = this.baseAlpha * pulse * twink;
        if (alpha <= 0.01) return;

        // Blit pre-baked sprite via hardware texture unit
        ctx.globalAlpha = alpha;
        const renderSize = this.size * 2.2;
        ctx.drawImage(this.sprite, drawX - renderSize * 0.5, drawY - renderSize * 0.5, renderSize, renderSize);
      }
    }

    const numDots = window.innerWidth < 768 ? 30 : 54;
    for (let i = 0; i < numDots; i++) dots.push(new Dot(false));
    for (let i = 0; i < numDots * 2; i++) dots.push(new Dot(true));

    let isRunning = true;
    function animate(t) {
      if (!isTabVisible || AppState.currentRoomId) {
        isRunning = false;
        return;
      }

      // Fast hardware clear (replaces slow destination-out blend stall)
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Random constellation lightning sparks
      if (Math.random() > 0.996 && dots.length > 2) {
        let n1 = dots[Math.floor(Math.random() * numDots)];
        let n2 = dots[Math.floor(Math.random() * numDots)];
        if (n1 && n2) {
          flashes.push({
            start: n1,
            end: n2,
            life: 1,
            segments: Math.floor(Math.random() * 4 + 3),
          });
        }
      }

      if (flashes.length > 0) {
        for (let i = flashes.length - 1; i >= 0; i--) {
          let f = flashes[i];
          f.life -= 0.03;
          if (f.life <= 0) {
            flashes.splice(i, 1);
            continue;
          }

          ctx.beginPath();
          let sx = f.start.x + f.start.parallaxX;
          let sy = f.start.y + f.start.parallaxY;
          let ex = f.end.x + f.end.parallaxX;
          let ey = f.end.y + f.end.parallaxY;
          ctx.moveTo(sx, sy);

          for (let s = 1; s < f.segments; s++) {
            let pt = s / f.segments;
            let nx = sx + (ex - sx) * pt + (Math.random() - 0.5) * (40 * f.life);
            let ny = sy + (ey - sy) * pt + (Math.random() - 0.5) * (40 * f.life);
            ctx.lineTo(nx, ny);
          }
          ctx.lineTo(ex, ey);
          ctx.strokeStyle = `rgba(255, 255, 255, ${f.life * 0.6})`;
          ctx.lineWidth = f.life * 2;
          ctx.stroke();
        }
      }

      const time = performance.now() * 0.0016;

      // 1. Update all dots
      for (let i = 0; i < dots.length; i++) {
        dots[i].update(time);
      }

      // 2. Batch draw all trails in a SINGLE pass
      ctx.beginPath();
      ctx.strokeStyle = "rgba(210, 225, 255, 0.14)";
      ctx.lineWidth = 1.0;
      ctx.lineCap = "round";
      for (let i = 0; i < numDots; i++) {
        const d = dots[i];
        if (d.historyLen > 1) {
          ctx.moveTo(d.histX[0], d.histY[0]);
          for (let h = 1; h < d.historyLen; h++) {
            ctx.lineTo(d.histX[h], d.histY[h]);
          }
        }
      }
      ctx.stroke();

      // 3. Batch draw constellation connections in a SINGLE pass
      ctx.beginPath();
      ctx.strokeStyle = "rgba(220, 230, 255, 0.12)";
      ctx.lineWidth = 0.55;
      const maxDistSq = 24000;
      for (let i = 0; i < numDots; i++) {
        const di = dots[i];
        const xi = di.x + di.parallaxX;
        const yi = di.y + di.parallaxY;

        for (let j = i + 1; j < numDots; j++) {
          const dj = dots[j];
          const xj = dj.x + dj.parallaxX;
          const dx = xi - xj;
          if (dx > 155 || dx < -155) continue;

          const yj = dj.y + dj.parallaxY;
          const dy = yi - yj;
          if (dy > 155 || dy < -155) continue;

          const dist = dx * dx + dy * dy;
          if (dist < maxDistSq) {
            ctx.moveTo(xi, yi);
            ctx.lineTo(xj, yj);
          }
        }
      }
      ctx.stroke();

      // 4. Draw dots with hardware sprites
      for (let i = 0; i < dots.length; i++) {
        dots[i].draw(ctx, time);
      }
      ctx.globalAlpha = 1.0;

      mouse.vx *= 0.8;
      mouse.vy *= 0.8;

      if (isTabVisible && !AppState.currentRoomId) {
        requestAnimationFrame(animate);
      } else {
        isRunning = false;
      }
    }
    requestAnimationFrame(animate);

    function resumeAnimation() {
      if (!isRunning && isTabVisible && !AppState.currentRoomId) {
        isRunning = true;
        requestAnimationFrame(animate);
      }
    }

    document.addEventListener("visibilitychange", () => {
      isTabVisible = !document.hidden;
      if (isTabVisible) resumeAnimation();
    });

    window.addEventListener("screenchange", (e) => {
      if (e.detail?.screenId === "lobby-screen") {
        resumeAnimation();
      }
    });
    window.resumeBackgroundFX = resumeAnimation;
  }
}

class EasterEggManager {
  static DURATION = 5000;
  static SOUND_URLS = {
    notification: "https://actions.google.com/sounds/v1/alarms/beep_short.ogg",
    glass:
      "https://actions.google.com/sounds/v1/impacts/glass_shatters_into_debris.ogg",
    vader:
      "https://actions.google.com/sounds/v1/science_fiction/alien_breath.ogg",
    moo: "https://actions.google.com/sounds/v1/animals/cow_moo_1.ogg", // cow sound
    grass:
      "https://actions.google.com/sounds/v1/water/waves_crashing_on_rock_beach.ogg",
    milk: "https://actions.google.com/sounds/v1/water/pour_water.ogg",
    popcorn:
      "https://actions.google.com/sounds/v1/foley/bubble_wrap_popping.ogg",
    nyan: "https://archive.org/download/nyancat_201906/nyancat.mp3",
    matrix:
      "https://actions.google.com/sounds/v1/science_fiction/sci_fi_hum.ogg",
    scream: "https://actions.google.com/sounds/v1/horror/male_scream_short.ogg",
    cheer:
      "https://actions.google.com/sounds/v1/crowds/large_crowd_cheer_and_clap.ogg",
  };
  static COMMANDS = new Map([
    ["/moo", "moo"],
    ["/grass", "grass"],
    ["/milk", "milk"],
    ["/popcorn", "popcorn"],
    ["/dvd", "dvd"],
    ["/matrix", "matrix"],
    ["/shh", "shh"],
    ["/nyan", "nyan"],
    ["/scream", "scream"],
    ["/cheer", "cheer"],
  ]);
  static KEYWORD_EFFECTS = {
    COWIO: "cow-cursor",
    GLASS: "glass",
    CINEMA: "cinema",
    POTATO: "potato",
    NINJA: "ninja",
    ZOMBIE: "zombie",
    SPACE: "space",
    MIRROR: "mirror",
  };
  static KONAMI = [
    "ArrowUp",
    "ArrowUp",
    "ArrowDown",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "ArrowLeft",
    "ArrowRight",
    "b",
    "a",
  ];
  static STICKERS = {
    cow: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Animals%20and%20Nature/Cow.webp",
    popcorn:
      "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Food%20and%20Drink/Popcorn.webp",
    milk: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Food%20and%20Drink/Glass%20Of%20Milk.webp",
    tv: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Objects/Television.webp",
    cat: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Animals%20and%20Nature/Cat.webp",
    clapper:
      "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Objects/Clapper%20Board.webp",
    scream:
      "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Smileys/Face%20Screaming%20In%20Fear.webp",
    clap: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/People/Clapping%20Hands.webp",
    tree: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Animals%20and%20Nature/Deciduous%20Tree.webp",
    rocket:
      "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Travel%20and%20Places/Rocket.webp",
    skull:
      "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Smileys/Skull.webp",
    party:
      "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Activity/Party%20Popper.webp",
    potato:
      "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Food%20and%20Drink/Canned%20Food.webp",
    mirror:
      "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Activity/Mirror%20Ball.webp",
    ninja:
      "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Smileys/Ghost.webp",
    glass:
      "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Food%20and%20Drink/Clinking%20Glasses.webp",
    vhs: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Objects/Clapper%20Board.webp",
  };

  static sticker(url, size = 48) {
    const fixedUrl = (window.Utils && Utils.fixEmojiUrl) ? Utils.fixEmojiUrl(url) : url;
    return `<img src="${fixedUrl}" class="easter-sticker" style="width:${size}px;height:${size}px;object-fit:contain;-webkit-transform:translateZ(0);transform:translateZ(0);" alt="" draggable="false" loading="eager" decoding="async">`;
  }

  static init() {
    this.injectStyles();
    this.ensureFxRoot();
    this.bindKeyboard();
  }

  static injectStyles() {
    const style = document.createElement("style");
    style.innerHTML = `
            body.easter-green {
                --bg: #031507;
                --panel: rgba(8, 28, 10, 0.92);
                --panel-hover: rgba(15, 45, 17, 0.96);
                --border: rgba(90, 255, 132, 0.16);
                --border-light: rgba(90, 255, 132, 0.32);
                --text-main: #eaffec;
                --text-muted: #8ec99a;
                --accent: #69ff88;
                --accent-hover: #43d762;
                --brand: #b7ffc4;
            }
            body.easter-roll #room-screen,
            body.easter-roll #lobby-screen {
                animation: easterRoll 15s cubic-bezier(0.22, 1, 0.36, 1);
                transform-origin: center center;
            }
            body.easter-matrix {
                background: #020704;
                color: #6dff8c;
                text-shadow: 0 0 8px rgba(109, 255, 140, 0.2);
            }
            body.easter-matrix .glass-panel,
            body.easter-matrix .chat-section,
            body.easter-matrix .bubble,
            body.easter-matrix .room-card,
            body.easter-matrix .user-item,
            body.easter-matrix .friend-item {
                border-color: rgba(109, 255, 140, 0.24) !important;
                background: rgba(5, 20, 8, 0.78) !important;
                box-shadow: 0 0 18px rgba(17, 255, 105, 0.08);
            }
            body.easter-vhs,
            body.easter-cinema,
            body.easter-zombie,
            body.easter-potato,
            body.easter-mirror,
            body.easter-space {
                transition: filter 0.9s ease, transform 0.9s ease;
            }
            body.easter-vhs { filter: saturate(0.85) contrast(1.1); }
            body.easter-zombie { filter: grayscale(0.9) contrast(1.2) sepia(0.35); }
            body.easter-potato {
                filter: contrast(1.15) saturate(1.1);
            }
            body.easter-potato::after {
                content: '';
                position: fixed; inset: 0; pointer-events: none; z-index: 3999;
                background: radial-gradient(circle at 80% 20%, rgba(255,200,100,0.12), transparent 40%);
            }
            body.easter-mirror {
                transform: scaleX(-1);
                transform-origin: center center;
            }
            .easter-sticker {
                filter: drop-shadow(0 8px 20px rgba(0,0,0,0.45));
                animation: easterStickerBob 2.4s ease-in-out infinite;
            }
            @keyframes easterStickerBob {
                0%, 100% { transform: translateY(0) rotate(0deg); }
                50% { transform: translateY(-8px) rotate(3deg); }
            }
            .easter-floating-stickers {
                position: fixed; inset: 0; pointer-events: none; z-index: 3998;
                overflow: hidden;
            }
            .easter-float-item {
                position: absolute;
                animation: easterFloatDrift 6s ease-in-out infinite;
            }
            @keyframes easterFloatDrift {
                0%, 100% { transform: translate(0,0) scale(1); opacity: 0.85; }
                50% { transform: translate(12px,-18px) scale(1.08); opacity: 1; }
            }
            body.easter-cinema::before {
                content: '';
                position: fixed; inset: 0; pointer-events: none; z-index: 3997;
                background: radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.75) 100%);
            }
            body.easter-space .glass-panel,
            body.easter-space .room-card,
            body.easter-space .user-item,
            body.easter-space .friend-item,
            body.easter-space .chat-section,
            body.easter-space .player-section {
                animation: easterFloatPanels 4s ease-in-out infinite;
            }
            body.easter-space .room-card:nth-child(2n),
            body.easter-space .user-item:nth-child(2n),
            body.easter-space .friend-item:nth-child(2n) {
                animation-delay: -1.2s;
            }
            body.easter-hide-ui #room-screen .chat-section,
            body.easter-hide-ui #room-screen .room-top-bar {
                opacity: 0;
                transform: translateY(-18px) scale(0.98);
                pointer-events: none;
            }
            body.easter-cow-cursor,
            body.easter-cow-cursor * {
                cursor: url("https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Animals%20and%20Nature/Cow.webp") 16 16, auto !important;
            }
            #easter-egg-root {
                position: fixed;
                inset: 0;
                pointer-events: none;
                z-index: 4000;
                overflow: hidden;
            }
            .easter-overlay {
                position: absolute;
                inset: 0;
                opacity: 0;
                transition: opacity 1s ease, transform 1s ease;
            }
            .easter-overlay.active {
                opacity: 1;
            }
            .easter-drop {
                position: absolute;
                top: -12vh;
                font-size: clamp(30px, 4vw, 50px);
                animation: easterPopcornDrop linear forwards;
                text-shadow: 0 6px 15px rgba(0,0,0,0.5);
            }
            #dvd-overlay {
                overflow: hidden;
            }
            .dvd-logo {
                position: absolute;
                left: 24px;
                top: 24px;
                padding: 14px 20px;
                border-radius: 18px;
                background: rgba(255,255,255,0.12);
                border: 1px solid rgba(255,255,255,0.35);
                color: #fff;
                font-size: 34px;
                font-weight: 900;
                letter-spacing: 2px;
                text-transform: uppercase;
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                box-shadow: 0 12px 30px rgba(0,0,0,0.35);
                transform: translateZ(0);
                -webkit-transform: translateZ(0);
            }
            #matrix-canvas,
            #vhs-canvas {
                width: 100%;
                height: 100%;
            }
            #vhs-overlay {
                mix-blend-mode: screen;
            }
            #glass-overlay svg {
                width: 100%;
                height: 100%;
                animation: shatterPulse 0.2s ease-out;
            }
            #cinema-overlay {
                background: rgba(0,0,0,0.65);
            }
            #nyan-overlay {
                position: fixed;
                inset: 0;
            }

            .nyan-cat {
                position: absolute;
                left: 0;
                top: 50%;
                transform: translate(-50%, -50%);
                font-size: 48px;
                filter: drop-shadow(0 6px 12px rgba(0,0,0,0.5));
                animation: nyanCruise 15s ease-in-out forwards;
            }
            body.easter-nyan #native-player,
            body.easter-nyan .video-container {
                filter: hue-rotate(0deg) saturate(1.35);
                animation: nyanVideo 1.8s linear infinite;
            }
            #crack-overlay path {
                fill: none;
                stroke: rgba(255,255,255,0.86);
                stroke-width: 2;
                stroke-linecap: round;
                stroke-linejoin: round;
                filter: drop-shadow(0 0 6px rgba(255,255,255,0.35));
            }
            
            /* ADVANCED MILK STYLES - FIXED & OPTIMIZED */
            #advanced-milk-container {
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                z-index: 5000; pointer-events: none; overflow: hidden; display: block;
            }
            #fluid-canvas {
                position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 5001; pointer-events: none;
            }
            #milk-glass {
                position: absolute; font-size: 120px; z-index: 5002; opacity: 0;
                transform: scale(0) rotate(-20deg); transition: all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
                pointer-events: none; filter: drop-shadow(0 0 30px rgba(255, 255, 255, 0.5));
                top: 50%; left: 50%; margin-top: -60px; margin-left: -60px;
            }
            #milk-glass.active { opacity: 1; transform: scale(1.4) rotate(0deg); }
            #milk-glass.pouring { animation: easterShake 0.15s infinite; }
            @keyframes easterShake {
                0% { transform: scale(1.4) rotate(-3deg) translateY(0); }
                50% { transform: scale(1.4) rotate(3deg) translateY(-8px); }
                100% { transform: scale(1.4) rotate(-3deg) translateY(0); }
            }
            @keyframes shatterPulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.02); }
                100% { transform: scale(1); }
            }

            @keyframes easterPopcornDrop {
                0% { transform: translate3d(0, -10vh, 0) rotate(0deg) scale(1); opacity: 0; }
                10% { opacity: 1; }
                80% { transform: translate3d(var(--drift, 0px), 80vh, 0) rotate(360deg) scale(1.2); opacity: 1; }
                100% { transform: translate3d(var(--drift, 0px), 120vh, 0) rotate(460deg) scale(0.8); opacity: 0; }
            }
            @keyframes easterRoll {
                0% { transform: rotate(0deg) scale(1); }
                50% { transform: rotate(180deg) scale(0.98); }
                100% { transform: rotate(360deg) scale(1); }
            }
            @keyframes easterFloatPanels {
                0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); }
                25% { transform: translate3d(10px, -12px, 0) rotate(0.8deg); }
                50% { transform: translate3d(-12px, -24px, 0) rotate(-0.8deg); }
                75% { transform: translate3d(8px, -10px, 0) rotate(0.6deg); }
            }
            @keyframes nyanRainbow {
                from { background-position: 0% 50%; }
                to { background-position: 220% 50%; }
            }
            @keyframes nyanCruise {
                0% { left: -10%; transform: translate(-50%, -50%) rotate(-5deg); }
                50% { transform: translate(-50%, -60%) rotate(5deg); }
                100% { left: 110%; transform: translate(-50%, -50%) rotate(-5deg); }
            }
            @keyframes nyanVideo {
                0% { filter: hue-rotate(0deg) saturate(1.2); }
                100% { filter: hue-rotate(360deg) saturate(1.45); }
            }
        `;
    document.head.appendChild(style);
  }

  static ensureFxRoot() {
    if (Utils.$("easter-egg-root")) return;
    const root = document.createElement("div");
    root.id = "easter-egg-root";
    root.innerHTML = `
            <div id="green-overlay" class="easter-overlay" style="background: radial-gradient(circle at 20% 20%, rgba(86, 255, 137, 0.18), transparent 35%), linear-gradient(160deg, rgba(4, 22, 8, 0.25), rgba(4, 22, 8, 0.58));"></div>
            <div id="dvd-overlay" class="easter-overlay"></div>
            <div id="matrix-overlay" class="easter-overlay"><canvas id="matrix-canvas"></canvas></div>
            <div id="vhs-overlay" class="easter-overlay"><canvas id="vhs-canvas"></canvas></div>
            <div id="glass-overlay" class="easter-overlay"></div>
            <div id="cinema-overlay" class="easter-overlay"></div>
            <div id="popcorn-overlay" class="easter-overlay"></div>
            <div id="nyan-overlay" class="easter-overlay"></div>
            <div id="easter-floating-root" class="easter-floating-stickers"></div>
        `;
    document.body.appendChild(root);
  }

  static spawnFloatingStickers(urls, count = 8) {
    const root = Utils.$("easter-floating-root");
    if (!root) return;
    root.innerHTML = "";
    for (let i = 0; i < count; i++) {
      const url = urls[i % urls.length];
      const el = document.createElement("div");
      el.className = "easter-float-item";
      el.style.left = `${8 + Math.random() * 84}%`;
      el.style.top = `${8 + Math.random() * 84}%`;
      el.style.animationDelay = `${-Math.random() * 4}s`;
      el.innerHTML = this.sticker(url, 36 + Math.floor(Math.random() * 28));
      root.appendChild(el);
    }
    root.style.opacity = "1";
  }

  static clearFloatingStickers() {
    const root = Utils.$("easter-floating-root");
    if (root) {
      root.style.opacity = "0";
      root.innerHTML = "";
    }
  }

  static bindKeyboard() {
    document.addEventListener("keydown", (e) => {
      const target = e.target;
      const isEditable =
        target instanceof HTMLElement &&
        (target.isContentEditable || /INPUT|TEXTAREA/.test(target.tagName));
      if (
        isEditable &&
        target instanceof HTMLInputElement &&
        target.type === "password"
      )
        return;
      this.handleKonami(e.key);
      this.handleWordSequence(e.key);
    });
  }

  static handleKonami(key) {
    if (!key) return;
    const expected = this.KONAMI[AppState.easterEggs.konamiIndex];
    const normalized = key.length === 1 ? key.toLowerCase() : key;
    if (normalized === expected) {
      AppState.easterEggs.konamiIndex += 1;
      if (AppState.easterEggs.konamiIndex === this.KONAMI.length) {
        AppState.easterEggs.konamiIndex = 0;
        this.activateLocalEffect(
          "konami",
          () => this.startVhs(),
          () => this.stopVhs(),
        );
      }
      return;
    }
    AppState.easterEggs.konamiIndex = normalized === this.KONAMI[0] ? 1 : 0;
  }

  static handleWordSequence(key) {
    if (!key) return;
    if (!/^[a-zа-я]$/i.test(key)) return;
    const now = Date.now();
    AppState.easterEggs.keyBuffer =
      now - AppState.easterEggs.lastKeyTs > 1200
        ? ""
        : AppState.easterEggs.keyBuffer;
    AppState.easterEggs.lastKeyTs = now;
    AppState.easterEggs.keyBuffer =
      `${AppState.easterEggs.keyBuffer}${key.toUpperCase()}`.slice(-12);

    Object.entries(this.KEYWORD_EFFECTS).forEach(([word, effect]) => {
      if (AppState.easterEggs.keyBuffer.endsWith(word)) {
        AppState.easterEggs.keyBuffer = "";
        this.runLocalKeyword(effect);
      }
    });
  }

  static runLocalKeyword(effect) {
    if (effect === "cow-cursor")
      return this.activateLocalEffect(
        "cow-cursor",
        () => document.body.classList.add("easter-cow-cursor"),
        () => document.body.classList.remove("easter-cow-cursor"),
      );
    if (effect === "glass")
      return this.activateLocalEffect(
        "glass-local",
        () => this.startGlassCrack(true),
        () => this.stopGlassCrack(),
      );
    if (effect === "cinema")
      return this.activateLocalEffect(
        "cinema",
        () => {
          document.body.classList.add("easter-cinema");
          this.showOverlay("cinema-overlay");
          const o = Utils.$("cinema-overlay");
          if (o)
            o.innerHTML = `<div style="position:absolute;left:50%;top:40%;transform:translate(-50%,-50%);text-align:center;">${this.sticker(this.STICKERS.clapper, 120)}<div style="color:#fff;font-weight:800;margin-top:12px;font-size:22px;letter-spacing:2px;">CINEMA MODE</div></div>`;
        },
        () => {
          document.body.classList.remove("easter-cinema");
          this.hideOverlay("cinema-overlay");
          const o = Utils.$("cinema-overlay");
          if (o) o.innerHTML = "";
        },
      );
    if (effect === "potato")
      return this.activateLocalEffect(
        "potato",
        () => {
          document.body.classList.add("easter-potato");
          this.spawnFloatingStickers(
            [this.STICKERS.potato, this.STICKERS.popcorn],
            10,
          );
        },
        () => {
          document.body.classList.remove("easter-potato");
          this.clearFloatingStickers();
        },
      );
    if (effect === "ninja")
      return this.activateLocalEffect(
        "ninja",
        () => {
          document.body.classList.add("easter-hide-ui");
          this.spawnFloatingStickers([this.STICKERS.ninja], 6);
        },
        () => {
          document.body.classList.remove("easter-hide-ui");
          this.clearFloatingStickers();
        },
      );
    if (effect === "zombie")
      return this.activateLocalEffect(
        "zombie",
        () => this.startZombie(),
        () => this.stopZombie(),
      );
    if (effect === "space")
      return this.activateLocalEffect(
        "space",
        () => {
          document.body.classList.add("easter-space");
          this.spawnFloatingStickers(
            [this.STICKERS.rocket, this.STICKERS.party],
            12,
          );
        },
        () => {
          document.body.classList.remove("easter-space");
          this.clearFloatingStickers();
        },
      );
    if (effect === "mirror")
      return this.activateLocalEffect(
        "mirror",
        () => {
          document.body.classList.add("easter-mirror");
          this.spawnFloatingStickers([this.STICKERS.mirror], 8);
        },
        () => {
          document.body.classList.remove("easter-mirror");
          this.clearFloatingStickers();
        },
      );
  }

  static async handleChatInput(text, chatRef, uid) {
    const trimmed = text.trim();
    const command = this.COMMANDS.get(trimmed.toLowerCase());
    const myName =
      AppState.usersCache.get(uid)?.name ||
      AppState.currentUser?.displayName ||
      "Кто-то";
    if (command) {
      await this.emitRoomEffect(command, { from: myName });
      Utils.toast(`Пасхалка ${trimmed} активирована`, "info");
      return true;
    }

    if (trimmed.toLowerCase() === "i am your father") {
      await push(chatRef, { uid, name: myName, text: trimmed, ts: Date.now() });
      await this.emitRoomEffect("vader", { from: myName });
      return true;
    }

    return false;
  }

  static async emitRoomEffect(type, extra = {}) {
    if (!AppState.currentRoomId) return;
    await push(ref(db, `rooms/${AppState.currentRoomId}/easterEggs`), {
      type,
      ts: Date.now(),
      uid: AppState.currentUser?.uid || null,
      ...extra,
    });
  }

  static bindRoom(roomId) {
    AppState.easterEggs.processedRoomEvents.clear();
    AppState.currentRoomJoinTs = Date.now(); // ФИКС: Запоминаем время входа, чтобы не смотреть старые пасхалки

    const fxRef = ref(db, `rooms/${roomId}/easterEggs`);
    const unsub = onChildAdded(fxRef, (snap) => {
      const payload = snap.val();
      if (!payload) return;

      // ФИКС СИНХРОНИЗАЦИИ: Игнорируем все, что было вызвано ДО захода в комнату, и старше 5 сек.
      if (Date.now() - Number(payload.ts || 0) > 5000) return;
      if (Number(payload.ts || 0) < AppState.currentRoomJoinTs) return;

      if (AppState.easterEggs.processedRoomEvents.has(snap.key)) return;
      AppState.easterEggs.processedRoomEvents.add(snap.key);
      this.applyRoomEffect(payload);
    });
    AppState.roomSubscriptions.push(unsub);
  }

  static applyRoomEffect(payload) {
    const fromName = payload.from ? ` от ${payload.from}` : "";
    switch (payload.type) {
      case "moo":
        Utils.toast(`Муууу${fromName}`, "info");
        this.activateLocalEffect(
          "moo",
          () => {
            this.playMoo();
            const interval = setInterval(() => this.playMoo(), 1500);
            AppState.easterEggs.animationHandles.set("moo", interval);
          },
          () => {
            clearInterval(AppState.easterEggs.animationHandles.get("moo"));
            AppState.easterEggs.animationHandles.delete("moo");
          },
        );
        break;
      case "grass":
        this.activateLocalEffect(
          "grass",
          () => {
            this.playSound(this.SOUND_URLS.grass, { volume: 0.5 });
            document.body.classList.add("easter-green");
            this.showOverlay("green-overlay");
            const g = Utils.$("green-overlay");
            if (g)
              g.innerHTML = `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:20px;flex-wrap:wrap;opacity:0.35;">${this.sticker(this.STICKERS.tree, 80)}${this.sticker(this.STICKERS.tree, 64)}${this.sticker(this.STICKERS.tree, 96)}</div>`;
          },
          () => {
            document.body.classList.remove("easter-green");
            this.hideOverlay("green-overlay");
            const g = Utils.$("green-overlay");
            if (g) g.innerHTML = "";
          },
        );
        break;
      case "milk":
        this.activateLocalEffect(
          "milk",
          () => this.startAdvancedMilk(),
          () => this.stopAdvancedMilk(),
        );
        break;
      case "popcorn":
        this.activateLocalEffect(
          "popcorn",
          () => this.startPopcornRain(),
          () => this.stopPopcornRain(),
        );
        break;
      case "dvd":
        this.activateLocalEffect(
          "dvd",
          () => this.startDvd(),
          () => this.stopDvd(),
        );
        break;
      case "roll":
        this.activateLocalEffect(
          "roll",
          () => {
            this.playSound(this.SOUND_URLS.roll, { volume: 0.5 });
            document.body.classList.add("easter-roll");
          },
          () => document.body.classList.remove("easter-roll"),
        );
        break;
      case "matrix":
        this.activateLocalEffect(
          "matrix",
          () => this.startMatrix(),
          () => this.stopMatrix(),
        );
        break;
      case "shh":
        this.activateLocalEffect(
          "shh",
          () => {
            AppState.easterEggs.notificationMutedUntil =
              Date.now() + this.DURATION;
            Utils.toast("Уведомления приглушены на 15 секунд", "info");
          },
          () => {
            AppState.easterEggs.notificationMutedUntil = 0;
          },
        );
        break;
      case "vader":
        this.activateLocalEffect(
          "vader",
          () => this.playVaderBreath(),
          () => {},
        );
        break;
      case "nyan":
        this.activateLocalEffect(
          "nyan",
          () => this.startNyan(),
          () => this.stopNyan(),
        );
        break;
      case "scream":
        Utils.toast(`Скример${fromName}`, "info");
        this.activateLocalEffect(
          "scream",
          () => {
            this.playSound(this.SOUND_URLS.scream, { volume: 0.8 });
            const el = document.createElement("div");
            el.style.cssText =
              "position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:99999;pointer-events:none;background:rgba(0,0,0,0.5);animation:fadeInUp 0.2s ease;";
            el.innerHTML = this.sticker(this.STICKERS.scream, 160);
            el.id = "easter-scream-flash";
            document.body.appendChild(el);
          },
          () => document.getElementById("easter-scream-flash")?.remove(),
          3000,
        );
        break;
      case "cheer":
        Utils.toast(`Овации${fromName}`, "success");
        this.activateLocalEffect(
          "cheer",
          () => {
            this.playSound(this.SOUND_URLS.cheer, { volume: 0.7 });
            this.spawnFloatingStickers(
              [this.STICKERS.clap, this.STICKERS.party],
              14,
            );
          },
          () => this.clearFloatingStickers(),
          6000,
        );
        break;
      default:
        break;
    }
  }

  static activateLocalEffect(name, start, stop, duration = this.DURATION) {
    const existing = AppState.easterEggs.activeEffects.get(name);
    if (existing) {
      clearTimeout(existing.timer);
      existing.stop?.();
    }
    start?.();
    const timer = setTimeout(() => {
      stop?.();
      AppState.easterEggs.activeEffects.delete(name);
    }, duration);
    AppState.easterEggs.activeEffects.set(name, { stop, timer });
  }

  static cleanupAllEffects() {
    for (const { stop, timer } of AppState.easterEggs.activeEffects.values()) {
      clearTimeout(timer);
      stop?.();
    }
    AppState.easterEggs.activeEffects.clear();

    // ФИКС: Остановка всех звуков при выходе
    if (AppState.easterEggs.audioPool) {
      for (const audio of AppState.easterEggs.audioPool) {
        try {
          audio.pause();
          audio.currentTime = 0;
          audio.src = "";
        } catch (e) {}
      }
      AppState.easterEggs.audioPool.clear();
    }

    AppState.easterEggs.notificationMutedUntil = 0;
    [
      "easter-green",
      "easter-roll",
      "easter-matrix",
      "easter-vhs",
      "easter-potato",
      "easter-mirror",
      "easter-space",
      "easter-hide-ui",
      "easter-cow-cursor",
      "easter-nyan",
      "easter-zombie",
    ].forEach((cls) => document.body.classList.remove(cls));
    [
      "green-overlay",
      "dvd-overlay",
      "matrix-overlay",
      "vhs-overlay",
      "glass-overlay",
      "cinema-overlay",
      "popcorn-overlay",
      "nyan-overlay",
    ].forEach((id) => this.hideOverlay(id));
    document.body.classList.remove("easter-cinema");
    this.clearFloatingStickers();
    this.stopMatrix();
    this.stopVhs();
    this.stopPopcornRain();
    this.stopDvd();
    this.stopGlassCrack();
    this.stopNyan();
    this.stopZombie();
    this.stopAdvancedMilk();
  }

  // ADVANCED MILK SIMULATION (ФИКСИРОВАННАЯ И ОПТИМИЗИРОВАННАЯ ВЕРСИЯ - 15 Секунд)
  static startAdvancedMilk() {
    if (this.milkActive) return;
    this.playSound(this.SOUND_URLS.milk, { volume: 0.5 });
    this.milkActive = true;
    let container = Utils.$("advanced-milk-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "advanced-milk-container";
      container.className = "milk-wave-container";
      document.body.appendChild(container);
    }
    const html = `
            <div class="milk-liquid" id="milk-fill-anim">
                <div class="milk-surface"></div>
            </div>
            <div style="position:fixed; top:40%; left:50%; transform:translate(-50%,-50%); font-size:120px; z-index:9999; 
                animation: bounceInMilk 2s infinite alternate ease-in-out; pointer-events:none;">${this.sticker(this.STICKERS.milk, 140)}</div>
        `;
    container.innerHTML = html;
    if (!document.getElementById("milk-css-fix")) {
      const style = document.createElement("style");
      style.id = "milk-css-fix";
      style.innerHTML = `
                .milk-wave-container { position: fixed; inset: 0; pointer-events: none; z-index: 10000; overflow: hidden; transform: translateZ(0); }
                .milk-liquid { position: absolute; bottom: 0; left: 0; right: 0; height: 120vh; background: rgba(255, 255, 255, 0.95); box-shadow: inset 0 20px 40px rgba(100,150,255,0.1); transform: translateY(120vh); transition: transform 13.5s cubic-bezier(0.1, 0.8, 0.1, 1); }
                .milk-liquid.active { transform: translateY(0); }
                @keyframes waveSpill { 0% { transform: translateX(0) scaleY(1); } 50% { transform: translateX(-15%) scaleY(1.1); } 100% { transform: translateX(-30%) scaleY(1); } }
                .milk-surface { position: absolute; top: -80px; left: 0; width: 200%; height: 100px; background: radial-gradient(ellipse at 50% 100%, rgba(255,255,255,0.95) 40%, transparent 100%); animation: waveSpill 3s infinite linear alternate; }
                @keyframes bounceInMilk { 0% { transform: translate(-50%, -50%) rotate(-10deg) scale(0.9); } 100% { transform: translate(-50%, -60%) rotate(10deg) scale(1.1); } }
            `;
      document.head.appendChild(style);
    }
    setTimeout(() => {
      const fill = document.getElementById("milk-fill-anim");
      if (fill) fill.classList.add("active");
    }, 50);
  }

  static stopAdvancedMilk() {
    if (!this.milkActive) return;
    this.milkActive = false;
    const fill = document.getElementById("milk-fill-anim");
    if (fill) fill.classList.remove("active");
    const container = Utils.$("advanced-milk-container");
    if (container) {
      container.style.transition = "opacity 1s";
      container.style.opacity = "0";
      setTimeout(() => container.remove(), 1000);
    }
  }

  static playNotification() {
    if (Date.now() < AppState.easterEggs.notificationMutedUntil) return;
    this.playSound(this.SOUND_URLS.notification, {
      volume: 0.28,
      fallback: () => this.playSimpleTone(880, 0.09, "square", 0.05),
    });
  }

  static playMoo() {
    this.playSound(this.SOUND_URLS.moo, { volume: 0.6 });

    const container = document.createElement("div");
    container.style.cssText = `position:fixed; inset:0; pointer-events:none; z-index:9999; display:flex; align-items:center; justify-content:center;`;
    const size = Math.min(window.innerWidth * 0.35, 280);
    container.innerHTML = `<div style="animation: mooZoom 2.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; will-change: transform, opacity;">${this.sticker(this.STICKERS.cow, size)}</div>`;
    if (!document.getElementById("moo-css")) {
      const s = document.createElement("style");
      s.id = "moo-css";
      s.innerHTML = `@keyframes mooZoom { 0% { transform: scale(0.1) translateY(50vh); opacity: 0; } 20% { opacity: 1; } 80% { opacity: 1; transform: scale(1.5) translateY(-5vh); } 100% { transform: scale(2) translateY(-10vh); opacity: 0; } }`;
      document.head.appendChild(s);
    }
    document.body.appendChild(container);
    setTimeout(() => container.remove(), 2600);
  }

  static playVaderBreath() {
    this.playSound(this.SOUND_URLS.vader, {
      volume: 0.45,
      fallback: () => {
        const audioCtx = this.getAudioContext();
        if (!audioCtx) return;
        const now = audioCtx.currentTime;
        const buffer = audioCtx.createBuffer(
          1,
          audioCtx.sampleRate * 2.2,
          audioCtx.sampleRate,
        );
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i += 1) {
          data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        }
        const src = audioCtx.createBufferSource();
        const filter = audioCtx.createBiquadFilter();
        const gain = audioCtx.createGain();
        src.buffer = buffer;
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(420, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.12, now + 0.25);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.1);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);
        src.start(now);
      },
    });
  }

  static startPopcornRain() {
    this.playSound(this.SOUND_URLS.popcorn, { volume: 0.5 });
    this.showOverlay("popcorn-overlay");
    const overlay = Utils.$("popcorn-overlay");
    if (!overlay) return;
    overlay.innerHTML = `
            <div style="position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); z-index:99; animation: rumblingBucket 0.5s infinite linear;">${this.sticker(this.STICKERS.popcorn, 120)}</div>
            <div id="popcorn-particles"></div>
        `;
    if (!document.getElementById("popcorn-css-fix")) {
      const style = document.createElement("style");
      style.id = "popcorn-css-fix";
      style.innerHTML = `
                @keyframes rumblingBucket { 0%{transform:translate(-50%,-50%) rotate(-5deg) scale(1);} 50%{transform:translate(-50%,-55%) rotate(5deg) scale(1.1);} 100%{transform:translate(-50%,-50%) rotate(-5deg) scale(1);} }
                .popcorn-p { position: absolute; left: 50%; top: 50%; font-size: 30px; will-change: transform, opacity; }
            `;
      document.head.appendChild(style);
    }
    const particles = Utils.$("popcorn-particles");
    const popcornInterval = setInterval(() => {
      if (!particles) return;
      for (let i = 0; i < 3; i++) {
        const item = document.createElement("div");
        item.className = "popcorn-p";
        item.innerHTML = this.sticker(this.STICKERS.popcorn, 28);
        particles.appendChild(item);
        const angle = Math.random() * Math.PI * 2;
        const velocity = 20 + Math.random() * 30;
        let vx = Math.cos(angle) * velocity;
        let vy = Math.sin(angle) * velocity - 20;
        let x = 0;
        let y = 0;
        let rot = 0;
        let rotV = (Math.random() - 0.5) * 20;
        const move = () => {
          if (!item.parentNode) return;
          x += vx;
          y += vy;
          vy += 1.5;
          rot += rotV;
          item.style.transform = `translate3d(calc(-50% + ${x}px), calc(-50% + ${y}px), 0) rotate(${rot}deg)`;
          item.style.opacity = Math.max(
            0,
            (window.innerHeight - Math.abs(y)) / window.innerHeight,
          );
          if (y > window.innerHeight / 2 + 100) item.remove();
          else requestAnimationFrame(move);
        };
        requestAnimationFrame(move);
      }
    }, 100);
    AppState.easterEggs.animationHandles.set("popcorn", popcornInterval);
  }

  static stopPopcornRain() {
    const interval = AppState.easterEggs.animationHandles.get("popcorn");
    if (interval) clearInterval(interval);
    const overlay = Utils.$("popcorn-overlay");
    if (overlay) {
      overlay.style.transition = "opacity 1s";
      overlay.style.opacity = "0";
      setTimeout(() => {
        this.hideOverlay("popcorn-overlay");
        overlay.innerHTML = "";
        overlay.style.opacity = "1";
        AppState.easterEggs.animationHandles.delete("popcorn");
      }, 1000);
    }
  }

  static startDvd() {
    this.showOverlay("dvd-overlay");
    const overlay = Utils.$("dvd-overlay");
    if (!overlay) return;
    if (AppState.easterEggs.animationHandles.has("dvd"))
      cancelAnimationFrame(AppState.easterEggs.animationHandles.get("dvd"));
    overlay.innerHTML = `<div class="dvd-logo" id="dvd-logo-anim" style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:16px 22px;">${this.sticker(this.STICKERS.tv, 56)}<span style="font-size:22px;font-weight:900;letter-spacing:2px">DVD</span><span style="font-size:12px;font-weight:700;letter-spacing:4px;opacity:0.9">VIDEO</span></div>`;
    if (!document.getElementById("dvd-css-fix")) {
      const style = document.createElement("style");
      style.id = "dvd-css-fix";
      style.innerHTML = `
                #dvd-logo-anim { position: absolute; left: 0; top: 0; padding: 12px 24px; border-radius: 18px; border: 3px solid currentColor; font-weight: 900; font-size: 38px; text-align: center; line-height: 1; font-family: Impact, sans-serif; box-shadow: 0 10px 30px currentColor; filter: brightness(1.2); will-change: transform, color; }
            `;
      document.head.appendChild(style);
    }
    const logo = document.getElementById("dvd-logo-anim");
    let x = Math.random() * (window.innerWidth - 150);
    let y = Math.random() * (window.innerHeight - 100);
    let dx = 4;
    let dy = 4;
    const colors = [
      "#f44336",
      "#e91e63",
      "#9c27b0",
      "#673ab7",
      "#3f51b5",
      "#2196f3",
      "#00bcd4",
      "#009688",
      "#4caf50",
      "#8bc34a",
      "#cddc39",
      "#ffeb3b",
      "#ffc107",
      "#ff9800",
      "#ff5722",
    ];
    let lastColor = colors[0];
    logo.style.color = lastColor;
    const tick = () => {
      if (!logo) return;
      const w = logo.offsetWidth || 150;
      const h = logo.offsetHeight || 100;
      x += dx;
      y += dy;
      let hit = false;
      if (x <= 0) {
        x = 0;
        dx = Math.abs(dx);
        hit = true;
      } else if (x + w >= window.innerWidth) {
        x = window.innerWidth - w;
        dx = -Math.abs(dx);
        hit = true;
      }
      if (y <= 0) {
        y = 0;
        dy = Math.abs(dy);
        hit = true;
      } else if (y + h >= window.innerHeight) {
        y = window.innerHeight - h;
        dy = -Math.abs(dy);
        hit = true;
      }
      if (hit) {
        let nc = colors[Math.floor(Math.random() * colors.length)];
        while (nc === lastColor)
          nc = colors[Math.floor(Math.random() * colors.length)];
        lastColor = nc;
        logo.style.color = nc;
      }
      logo.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      AppState.easterEggs.animationHandles.set(
        "dvd",
        requestAnimationFrame(tick),
      );
    };
    tick();
  }

  static stopDvd() {
    this.hideOverlay("dvd-overlay");
    setTimeout(() => {
      const overlay = Utils.$("dvd-overlay");
      if (overlay && !overlay.classList.contains("active")) {
        cancelAnimationFrame(AppState.easterEggs.animationHandles.get("dvd"));
        AppState.easterEggs.animationHandles.delete("dvd");
        overlay.innerHTML = "";
      }
    }, 1000);
  }

  static startMatrix() {
    this.playSound(this.SOUND_URLS.matrix, { volume: 0.5 });
    document.body.classList.add("easter-matrix");
    this.showOverlay("matrix-overlay");
    const canvas = Utils.$("matrix-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    const fontSize = 18;
    const columns = Math.ceil(canvas.width / fontSize);
    const drops = Array(columns).fill(1);
    const chars = "01アカサタナハマヤラワXYZ$#<>[]{}";
    const draw = () => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#69ff88";
      ctx.fillStyle = "#69ff88";
      ctx.font = `${fontSize}px monospace`;
      for (let i = 0; i < drops.length; i += 1) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.98)
          drops[i] = 0;
        drops[i] += 1;
      }
      ctx.shadowBlur = 0; // reset
      const raf = requestAnimationFrame(draw);
      AppState.easterEggs.animationHandles.set("matrix", raf);
    };
    draw();
  }

  static stopMatrix() {
    document.body.classList.remove("easter-matrix");
    this.hideOverlay("matrix-overlay");
    setTimeout(() => {
      const overlay = Utils.$("matrix-overlay");
      if (overlay && !overlay.classList.contains("active")) {
        cancelAnimationFrame(
          AppState.easterEggs.animationHandles.get("matrix"),
        );
        AppState.easterEggs.animationHandles.delete("matrix");
        const canvas = Utils.$("matrix-canvas");
        const ctx = canvas?.getContext("2d");
        if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }, 1000);
  }

  static startVhs() {
    document.body.classList.add("easter-vhs");
    this.showOverlay("vhs-overlay");
    const overlay = Utils.$("vhs-overlay");
    if (!overlay) return;
    if (!document.getElementById("vhs-css-fix")) {
      const style = document.createElement("style");
      style.id = "vhs-css-fix";
      style.innerHTML = `
                @keyframes vhsGlitchAnim {
                    0% { transform: translateY(0) scale(1.01); filter: hue-rotate(0deg); }
                    50% { transform: translateY(2px) scale(1.01); filter: hue-rotate(4deg); }
                    100% { transform: translateY(-1px) scale(1.0); filter: hue-rotate(-2deg); }
                }
                @keyframes vhsTrackDown { 0% { top: -10vh; } 100% { top: 110vh; } }
                .vhs-css-overlay { position: fixed; inset: 0; pointer-events: none; z-index: 9998; background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06)); background-size: 100% 2px, 3px 100%; animation: vhsGlitchAnim 0.15s infinite alternate ease-in-out; }
                .vhs-track-line { position: absolute; left: 0; right: 0; height: 10vh; background: linear-gradient(to bottom, transparent, rgba(255,255,255,0.1), transparent); animation: vhsTrackDown 4s linear infinite; }
                .vhs-text { position: absolute; top: 40px; left: 40px; color: #fff; font-family: "Courier New", monospace; font-size: 32px; font-weight: bold; text-shadow: 2px 2px 0px blue, -2px -2px 0px red; }
            `;
      document.head.appendChild(style);
    }
    overlay.innerHTML = `
            <div class="vhs-css-overlay">
                <div class="vhs-track-line"></div>
                <div class="vhs-text" id="vhs-time-text" style="display:flex;align-items:center;gap:12px;">${this.sticker(this.STICKERS.vhs, 48)}<span>PLAY ►</span></div>
            </div>
        `;
    const vhsInterval = setInterval(() => {
      const el = document.getElementById("vhs-time-text");
      if (el) {
        const d = new Date();
        const pad = (n) => n.toString().padStart(2, "0");
        const t = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
        el.innerHTML = `PLAY ►<br><span style="font-size:24px">${t}</span>`;
      }
    }, 1000);
    AppState.easterEggs.animationHandles.set("vhs-text", vhsInterval);
  }

  static stopVhs() {
    document.body.classList.remove("easter-vhs");
    const interval = AppState.easterEggs.animationHandles.get("vhs-text");
    if (interval) clearInterval(interval);
    AppState.easterEggs.animationHandles.delete("vhs-text");

    const overlay = Utils.$("vhs-overlay");
    if (overlay) {
      overlay.style.transition = "opacity 1s";
      overlay.style.opacity = "0";
      setTimeout(() => {
        this.hideOverlay("vhs-overlay");
        overlay.innerHTML = "";
        overlay.style.opacity = "1";
      }, 1000);
    }
  }

  static startGlassCrack(playSound = false) {
    this.showOverlay("glass-overlay");
    const overlay = Utils.$("glass-overlay");
    if (!overlay) return;
    overlay.innerHTML = `
            <div style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); 
                        width: 200vmax; height: 200vmax; 
                        background: radial-gradient(circle, transparent 20%, rgba(255,255,255,0.75) 22%, transparent 25%),
                                    radial-gradient(circle, transparent 40%, rgba(255,255,255,0.5) 42%, transparent 45%);
                        clip-path: polygon(50% 50%, 0% 0%, 20% 0%, 50% 50%, 40% 0%, 60% 0%, 50% 50%, 80% 0%, 100% 0%, 50% 50%, 100% 20%, 100% 40%, 50% 50%, 100% 60%, 100% 80%, 50% 50%, 100% 100%, 80% 100%, 50% 50%, 60% 100%, 40% 100%, 50% 50%, 20% 100%, 0% 100%, 50% 50%, 0% 80%, 0% 60%, 50% 50%, 0% 40%, 0% 20%, 50% 50%);
                        z-index: 10000; pointer-events: none; opacity: 1; animation: glassFadeOut 2.5s forwards;">
            </div>
            <div style="position:fixed; inset:0; background:white; opacity:1; animation: flashWhite 0.5s ease-out forwards; pointer-events:none; z-index:10001;"></div>
            <div style="position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); animation: txtShake 0.4s; pointer-events:none; z-index:10002;">${this.sticker(this.STICKERS.glass, 100)}</div>
        `;
    if (!document.getElementById("glass-css-fix")) {
      const style = document.createElement("style");
      style.id = "glass-css-fix";
      style.innerHTML = `
                @keyframes flashWhite { 0% {opacity: 1;} 100% {opacity: 0;} }
                @keyframes glassFadeOut { 0% {opacity:0.9; transform: translate(-50%,-50%) scale(1);} 10% {transform: translate(-50%,-50%) scale(1.05);} 100% {opacity:0; transform: translate(-50%,-50%) scale(1.1);} }
                @keyframes txtShake { 0%{transform:translate(-50%,-50%) rotate(-5deg);} 25%{transform:translate(-52%,-48%) rotate(5deg);} 50%{transform:translate(-48%,-52%) rotate(-5deg);} 100%{transform:translate(-50%,-50%) rotate(0);} }
            `;
      document.head.appendChild(style);
    }
    if (playSound) {
      this.playSound(this.SOUND_URLS.glass, {
        volume: 0.35,
        fallback: () => this.playSimpleTone(180, 0.18, "sawtooth", 0.05),
      });
    }
  }

  static stopGlassCrack() {
    this.hideOverlay("glass-overlay");
    setTimeout(() => {
      const overlay = Utils.$("glass-overlay");
      if (overlay && !overlay.classList.contains("active"))
        overlay.innerHTML = "";
    }, 1000);
  }

  static startNyan() {
    this.playSound(this.SOUND_URLS.nyan, { volume: 0.5 });
    document.body.classList.add("easter-nyan");
    this.showOverlay("nyan-overlay");
    const overlay = Utils.$("nyan-overlay");
    if (overlay) {
      overlay.innerHTML = `
                <div id="nyan-cat-anim" style="position:absolute; transform:translate3d(-200px, 50vh, 0); will-change: transform; display:flex; align-items:center;">
                    <div style="position:absolute; top:50%; right:70px; width:200vw; height:36px; transform:translateY(-50%); background:linear-gradient(to bottom, red 16%, orange 16% 32%, yellow 32% 48%, green 48% 64%, blue 64% 80%, purple 80%); z-index:-1; opacity:0.85; border-radius:18px 0 0 18px;"></div>
                    ${this.sticker(this.STICKERS.cat, 72)}
                </div>
            `;
      if (!document.getElementById("nyan-css-fix")) {
        const style = document.createElement("style");
        style.id = "nyan-css-fix";
        style.innerHTML = `
                    @keyframes nyanSuperFly {
                        0% { transform: translate3d(-20vw, 40vh, 0) scale(1); }
                        25% { transform: translate3d(25vw, 60vh, 0) scale(1.5) rotate(15deg); }
                        50% { transform: translate3d(50vw, 30vh, 0) scale(1.2) rotate(-10deg); }
                        75% { transform: translate3d(75vw, 70vh, 0) scale(1.6) rotate(20deg); }
                        100% { transform: translate3d(120vw, 50vh, 0) scale(1) rotate(0deg); }
                    }
                    #nyan-cat-anim { animation: nyanSuperFly 5s linear infinite; filter: drop-shadow(0 0 20px rgba(255,100,255,0.8)); }
                `;
        document.head.appendChild(style);
      }
    }
  }

  static stopNyan() {
    document.body.classList.remove("easter-nyan");
    const overlay = Utils.$("nyan-overlay");
    if (overlay) {
      overlay.style.transition = "opacity 1s";
      overlay.style.opacity = "0";
      setTimeout(() => {
        this.hideOverlay("nyan-overlay");
        overlay.innerHTML = "";
        overlay.style.opacity = "1";
      }, 1000);
    }
  }

  static startZombie() {
    document.body.classList.add("easter-zombie");
    this.spawnFloatingStickers([this.STICKERS.skull], 7);
    const video = Utils.$("native-player");
    if (video) {
      video.dataset.originalPlaybackRate = String(video.playbackRate || 1);
      video.playbackRate = 0.5;
    }
  }

  static stopZombie() {
    document.body.classList.remove("easter-zombie");
    this.clearFloatingStickers();
    setTimeout(() => {
      const video = Utils.$("native-player");
      if (video && video.dataset.originalPlaybackRate) {
        video.playbackRate = Number(video.dataset.originalPlaybackRate || 1);
        delete video.dataset.originalPlaybackRate;
      }
    }, 1000);
  }

  static showOverlay(id) {
    const el = Utils.$(id);
    if (el) el.classList.add("active");
  }

  static hideOverlay(id) {
    const el = Utils.$(id);
    if (el) el.classList.remove("active");
  }

  static getAudioContext() {
    if (!this.audioContext) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      this.audioContext = new Ctx();
    }
    if (this.audioContext.state === "suspended") {
      this.audioContext.resume().catch(() => {});
    }
    return this.audioContext;
  }

  static playSimpleTone(frequency, duration, type = "sine", gainValue = 0.04) {
    const audioCtx = this.getAudioContext();
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(audioCtx.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  static playSound(url, { volume = 0.35, fallback } = {}) {
    const audio = new Audio(url);
    audio.volume = volume;
    audio.preload = "auto";
    AppState.easterEggs.audioPool.add(audio);
    const cleanup = () => AppState.easterEggs.audioPool.delete(audio);
    audio.onended = cleanup;
    audio.onerror = () => {
      cleanup();
      fallback?.();
    };
    audio
      .play()
      .then(() => {
        setTimeout(() => cleanup(), 6000);
      })
      .catch(() => {
        cleanup();
        fallback?.();
      });
  }
}

// ============================================================================
// 3. АВТОРИЗАЦИЯ И СТРОГИЕ ПРОВЕРКИ ПРОФИЛЕЙ
// ============================================================================

window.PartnerBondEngine = PartnerBondEngine;
window.PartnerRelationshipPanel = PartnerRelationshipPanel;
window.BackgroundFX = BackgroundFX;
window.EasterEggManager = EasterEggManager;
export {
  PartnerBondEngine,
  PartnerRelationshipPanel,
  BackgroundFX,
  EasterEggManager
};
