const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const norm = (v) => {
    const l = Math.hypot(v.x, v.y, v.z) || 1;
    return { x: v.x / l, y: v.y / l, z: v.z / l };
};
// -- Incident geometry (metres, pitch coordinates) -------------------------
// The pitch runs along +Z. The incident is wide right, on the halfway-third.
const A0 = { x: 24.35, z: -3.6 };
const AC = { x: 27.35, z: 9.45 };
const A_CTRL = { x: 24.0, z: 3.15 };
const B0 = { x: 28.48, z: 2.35 };
const B_CTRL = { x: 28.68, z: 6.5 };
const BC = { x: 27.96, z: 10.02 };
const BALL_OFFSET = { x: 0.66, z: 0.82 };
const TOUCHLINE_X = 34;
const duration = 3.3;
const dt = 1 / 120;
const G = 9.81;
function bezier(a, c, b, t) {
    const u = 1 - t;
    return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, z: u * u * a.z + 2 * u * t * c.z + t * t * b.z };
}
function bezierPrime(a, c, b, t) {
    const u = 1 - t;
    return { x: 2 * u * (c.x - a.x) + 2 * t * (b.x - c.x), z: 2 * u * (c.z - a.z) + 2 * t * (b.z - c.z) };
}
function bezierLength(a, c, b, steps = 100) {
    let prev = bezier(a, c, b, 0);
    let len = 0;
    for (let i = 1; i <= steps; i++) {
        const p = bezier(a, c, b, i / steps);
        len += Math.hypot(p.x - prev.x, p.z - prev.z);
        prev = p;
    }
    return len;
}
const trackLength = bezierLength(A0, A_CTRL, AC);
/** Distance along the tackler's curved approach as a function of time. */
function tacklerDistance(t) {
    const v0 = 5.6;
    const a = 1.5;
    return v0 * t + 0.5 * a * t * t;
}
function distanceToTime(d) {
    const v0 = 5.6;
    const a = 1.5;
    return (-v0 + Math.sqrt(v0 * v0 + 2 * a * d)) / a;
}
function pointAtDistance(d) {
    // Reparameterise using a small numeric search for constant-speed arc travel.
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 18; i++) {
        const mid = (lo + hi) / 2;
        if (bezierLength(A0, A_CTRL, AC, 40) * mid < d)
            lo = mid;
        else
            hi = mid;
    }
    const tt = (lo + hi) / 2;
    const p = bezier(A0, A_CTRL, AC, tt);
    const d0 = bezierPrime(A0, A_CTRL, AC, tt);
    return { p, tangent: d0, u: tt };
}
const CONTACT_T = distanceToTime(trackLength);
const COMMIT_T = CONTACT_T - 0.64;
const FEET_LEAVE_T = CONTACT_T - 0.34;
const BALL_RELEASE_T = CONTACT_T + 0.04;
const WHISTLE_T = CONTACT_T + 1;
const SLIDE_DIR = norm({ x: 0.55, y: 0, z: 0.83 });
export function buildSimulation() {
    const steps = Math.round(duration / dt) + 1;
    const frames = [];
    const aTrail = [];
    const bTrail = [];
    let a = { ...A0 };
    let aSpeed = 6.25;
    let aDir = { x: 0.22, z: 0.975 };
    let aPhase = 'sprint';
    let aPhaseStart = 0;
    let aPitch = 0;
    let aRoll = 0;
    let aComY = 1.0;
    let b = { ...B0 };
    let bSpeed = 4.0;
    let bPhase = 'carry';
    let bPhaseStart = 0;
    let bPitch = 0;
    let bRoll = 0;
    let bComY = 1.0;
    let bVx = 0;
    let bVz = 4.5;
    let bOmega = 0;
    let bDir = norm({ x: BC.x - B0.x, y: 0, z: BC.z - B0.z });
    const bSpeedAtContact = bezierLength(B0, B_CTRL, BC) / CONTACT_T;
    let ball = {
        p: { x: B0.x + BALL_OFFSET.x, y: 0.11, z: B0.z + BALL_OFFSET.z },
        v: { x: 0, y: 0, z: bSpeed },
        spin: { x: 0, y: 0, z: 0 },
        rolling: true,
        out: false,
    };
    // Physics impulse, derived from the contact geometry.
    const speedAtContact = 5.6 + 1.5 * CONTACT_T;
    const aVelAtContact = norm({ x: AC.x - A_CTRL.x, y: 0, z: AC.z - A_CTRL.z });
    const closingDir = norm({ x: BC.x - AC.x, y: 0, z: BC.z - AC.z });
    const relative = {
        x: aVelAtContact.x * speedAtContact - bDir.x * bSpeed,
        z: aVelAtContact.z * speedAtContact - bDir.z * bSpeed,
    };
    const closingSpeed = Math.max(0.1, relative.x * closingDir.x + relative.z * closingDir.z);
    const normal = norm({ x: closingDir.x * 0.72 + 0.12, y: 0.18, z: closingDir.z * 0.72 + 0.55 });
    const restitution = 0.1;
    const mEff = (82 * 76) / (82 + 76);
    const impulse = Math.round(mEff * (1 + restitution) * closingSpeed * 10) / 10;
    const contactPoint = { x: BC.x + 0.1, y: 0.31, z: BC.z + 0.12 };
    const peakForce = Math.round((impulse / 0.092) * 2.3);
    const impact = {
        t: CONTACT_T,
        point: contactPoint,
        normal,
        impulse,
        peakForce,
        duration: 0.092,
        closingSpeed: Math.round(closingSpeed * 100) / 100,
        relativeAngle: 31,
        studs: 4,
        ballDelay: 0.043,
    };
    const bImpulseV = {
        x: (normal.x * impulse) / 76,
        z: (normal.z * impulse) / 76,
    };
    let ballReleased = false;
    let bGrounded = false;
    let aGrounded = true;
    let aRiseStart = -1;
    let aPhasePrev = aPhase;
    let bPhasePrev = bPhase;
    for (let i = 0; i < steps; i++) {
        const t = i * dt;
        // ---------- Tackler ------------------------------------------------
        if (t < CONTACT_T) {
            const d = clamp(tacklerDistance(t), 0, trackLength);
            const { p, tangent } = pointAtDistance(d);
            a.x = p.x;
            a.z = p.z;
            const len = Math.hypot(tangent.x, tangent.z) || 1;
            aDir = { x: tangent.x / len, z: tangent.z / len };
            aSpeed = 5.6 + 1.5 * t;
            if (t < COMMIT_T) {
                aPhase = 'sprint';
            }
            else if (t < FEET_LEAVE_T) {
                aPhase = 'commit';
                aPitch = -0.12 * smooth((t - COMMIT_T) / (FEET_LEAVE_T - COMMIT_T));
                aComY = 1.0 - 0.1 * smooth((t - COMMIT_T) / (FEET_LEAVE_T - COMMIT_T));
                aDir = norm({ x: lerp(aDir.x, SLIDE_DIR.x, 0.35 * smooth((t - COMMIT_T) / (FEET_LEAVE_T - COMMIT_T))), y: 0, z: lerp(aDir.z, SLIDE_DIR.z, 0.35 * smooth((t - COMMIT_T) / (FEET_LEAVE_T - COMMIT_T))) });
            }
            else {
                aPhase = 'slide';
                const k = smooth((t - FEET_LEAVE_T) / (CONTACT_T - FEET_LEAVE_T));
                aPitch = lerp(-0.12, -0.55, k);
                aComY = lerp(0.9, 0.31, k);
                aRoll = 0.1 * k;
                aDir = norm({ x: lerp(SLIDE_DIR.x, aDir.x, 0.18 * (1 - k)), y: 0, z: lerp(SLIDE_DIR.z, aDir.z, 0.18 * (1 - k)) });
            }
            if (t > FEET_LEAVE_T)
                aGrounded = true;
            // first contact detection: the leading boot reaches the carrier's ankle
            if (t >= CONTACT_T - dt) {
                aPhase = 'slide';
                aPitch = -0.55;
                aComY = 0.31;
            }
        }
        else {
            if (t < CONTACT_T + dt) {
                aDir = SLIDE_DIR;
                aSpeed = 6.3;
            }
            const slideT = t - CONTACT_T;
            const sp = Math.max(0, 6.3 - 7.8 * slideT);
            if (sp > 0.05) {
                a.x += aDir.x * sp * dt;
                a.z += aDir.z * sp * dt;
                aSpeed = sp;
                aPhase = 'slide';
                aGrounded = true;
                const k = clamp(slideT / 0.95, 0, 1);
                aPitch = lerp(-0.55, -0.9, smooth(k));
                aRoll = lerp(0.1, 0.32, smooth(k));
                aComY = lerp(0.31, 0.26, smooth(k));
            }
            else {
                aSpeed = 0;
                if (aRiseStart < 0)
                    aRiseStart = t;
                const rk = clamp((t - aRiseStart) / 0.45, 0, 1);
                aPhase = rk < 1 ? 'rise' : 'stand';
                // Getting up after a slide is a quick push-to-feet, not a long struggle.
                aPitch = lerp(-0.9, 0, smooth(rk));
                aRoll = lerp(0.32, 0, smooth(rk));
                aComY = lerp(0.26, 1.0, smooth(rk));
                aGrounded = rk > 0.86;
            }
        }
        // ---------- Carrier ------------------------------------------------
        if (t < CONTACT_T) {
            const k = clamp(t / CONTACT_T, 0, 1);
            const p = bezier(B0, B_CTRL, BC, k);
            const bp = bezierPrime(B0, B_CTRL, BC, k);
            b = p;
            bVx = bp.x / CONTACT_T;
            bVz = bp.z / CONTACT_T;
            bSpeed = Math.hypot(bVx, bVz);
            bPhase = 'carry';
            bPitch = 0.12;
            bComY = 1.0;
            bGrounded = true;
        }
        else {
            const k = t - CONTACT_T;
            if (bOmega === 0) {
                // Angular impulse at the lower leg; the carrier's support is swept away
                // and gravity takes over from there.
                bOmega = 1.6 + Math.min(2.4, Math.hypot(bImpulseV.x, bImpulseV.z) * 0.9);
            }
            if (k < 0.92) {
                bPhase = 'fall';
                const gravityTorque = 2.9 * Math.sin(Math.max(0.08, bPitch));
                bOmega += (gravityTorque - 1.25 * bOmega) * dt;
                bPitch += bOmega * dt;
                bPitch = Math.min(bPitch, 1.5);
                bComY = Math.max(0.18, 0.2 + 0.82 * Math.cos(bPitch));
                bRoll = lerp(0, -0.22, Math.min(1, bPitch / 1.5));
                const damping = Math.exp(-2.4 * k);
                b.x += (bVx + bImpulseV.x * 0.75 * damping) * dt;
                b.z += (bVz + bImpulseV.z * 0.75 * damping) * dt;
                bSpeed = Math.hypot(bVx, bVz) * (1 - Math.min(1, k / 0.9));
                bGrounded = bPitch > 1.35;
            }
            else {
                bPhase = 'ground';
                bPitch = lerp(1.5, 1.48, smooth(clamp((k - 0.92) / 0.18, 0, 1)));
                bRoll = -0.22;
                bComY = 0.18;
                bSpeed = 0;
                bGrounded = true;
            }
        }
        if (aPhase !== aPhasePrev) {
            aPhaseStart = t;
            aPhasePrev = aPhase;
        }
        if (bPhase !== bPhasePrev) {
            bPhaseStart = t;
            bPhasePrev = bPhase;
        }
        // ---------- Ball ---------------------------------------------------
        if (!ballReleased && t >= BALL_RELEASE_T) {
            ballReleased = true;
            ball.rolling = false;
            // Foot velocity at release + the coefficient of restitution of a boot.
            ball.v = { x: 6.1, y: 2.7, z: 10.8 };
            ball.spin = { x: -24, y: 6, z: 12 };
        }
        if (ballReleased) {
            const speed = Math.hypot(ball.v.x, ball.v.y, ball.v.z);
            const dragK = 0.0125;
            ball.v.x -= ball.v.x * dragK * speed * dt;
            ball.v.z -= ball.v.z * dragK * speed * dt;
            ball.v.y -= (G + ball.v.y * dragK * speed) * dt;
            // simple Magnus (side-spin)
            ball.v.x += ball.spin.z * 0.018 * dt;
            ball.v.z -= ball.spin.x * 0.002 * dt;
            ball.p.x += ball.v.x * dt;
            ball.p.y += ball.v.y * dt;
            ball.p.z += ball.v.z * dt;
            if (ball.p.y < 0.11 && ball.v.y < 0) {
                ball.p.y = 0.11;
                ball.v.y = -ball.v.y * 0.62;
                ball.v.x *= 0.82;
                ball.v.z *= 0.82;
            }
            if (!ball.out && ball.p.x > TOUCHLINE_X)
                ball.out = true;
        }
        else {
            ball.p.x = b.x + BALL_OFFSET.x;
            ball.p.z = b.z + BALL_OFFSET.z;
            ball.p.y = 0.11;
            ball.v.z = bSpeed;
            ball.rolling = true;
        }
        // Trails (sub-sampled, recent ~1.6 s)
        if (i % 6 === 0) {
            aTrail.push({ x: a.x, z: a.z });
            bTrail.push({ x: b.x, z: b.z });
            if (aTrail.length > 80)
                aTrail.shift();
            if (bTrail.length > 80)
                bTrail.shift();
        }
        const isSlide = aPhase === 'slide';
        const leadDir = isSlide ? SLIDE_DIR : aDir;
        const leadReach = isSlide ? lerp(0.55, 1.02, clamp((t - FEET_LEAVE_T) / 0.34, 0, 1)) : 0.32;
        const leadFoot = {
            x: a.x + leadDir.x * leadReach,
            y: isSlide ? 0.28 : 0.08,
            z: a.z + leadDir.z * leadReach,
        };
        const trailFoot = {
            x: a.x - leadDir.x * 0.42,
            y: 0.08,
            z: a.z - leadDir.z * 0.42,
        };
        frames.push({
            t,
            tackler: {
                x: a.x,
                z: a.z,
                yaw: Math.atan2(aDir.x, aDir.z) - (isSlide ? 0.18 : 0),
                speed: aSpeed,
                vx: aSpeed * aDir.x,
                vz: aSpeed * aDir.z,
                phase: aPhase,
                phaseT: t - aPhaseStart,
                pitch: aPitch,
                roll: aRoll,
                comY: aComY,
                leadFoot,
                trailFoot,
                stride: (t * (aSpeed / 2.6) + 0.12) % 1,
                brace: 0,
                grounded: aGrounded,
                sinceContact: t - CONTACT_T,
            },
            carrier: {
                x: b.x,
                z: b.z,
                yaw: Math.atan2(bDir.x, bDir.z),
                speed: bSpeed,
                vx: bVx,
                vz: bVz,
                phase: bPhase,
                phaseT: t - bPhaseStart,
                pitch: bPitch,
                roll: bRoll,
                comY: bComY,
                leadFoot: { x: b.x + 0.18, y: 0.06, z: b.z + 0.22 },
                trailFoot: { x: b.x - 0.18, y: 0.06, z: b.z - 0.22 },
                stride: (t * 2.25 + 0.19) % 1,
                brace: bPhase === 'fall' ? clamp((t - CONTACT_T - 0.1) / 0.45, 0, 1) : 0,
                grounded: bGrounded,
                sinceContact: t - CONTACT_T,
            },
            ball: { ...ball, p: { ...ball.p }, v: { ...ball.v }, spin: { ...ball.spin } },
            impact: t >= CONTACT_T && t < CONTACT_T + 1 / 30 ? impact : null,
            aTrail: aTrail.slice(),
            bTrail: bTrail.slice(),
        });
    }
    const whistleIndex = Math.round(WHISTLE_T / dt);
    const whistleBall = frames[whistleIndex]?.ball;
    if (whistleBall) {
        for (let index = whistleIndex + 1; index < frames.length; index += 1) {
            frames[index].ball = {
                ...frames[index].ball,
                p: { ...whistleBall.p },
                v: { x: 0, y: 0, z: 0 },
                spin: { x: 0, y: 0, z: 0 },
                rolling: false,
            };
        }
    }
    const events = [
        { id: 'chase', label: 'Recovery sprint', short: 'SPRINT', t: 0.22, lane: 'tackler', tone: 'accent', detail: 'Tackler closes from side-rear at 29.5 km/h.' },
        { id: 'commit', label: 'Challenge committed', short: 'COMMIT', t: 1.08, lane: 'tackler', tone: 'accent', detail: 'Tackler leaves his feet; leading leg begins to extend.' },
        { id: 'contact', label: 'First contact', short: 'CONTACT', t: CONTACT_T, lane: 'tackler', tone: 'danger', detail: 'Studs contact the carrier’s lower leg at 0.31 m. No ball contact.' },
        { id: 'ball', label: 'Ball released', short: 'BALL', t: BALL_RELEASE_T, lane: 'ball', tone: 'ball', detail: 'Ball leaves the boot at 12.1 m/s after the player contact.' },
        { id: 'fall', label: 'Carrier grounded', short: 'GROUND', t: CONTACT_T + 0.84, lane: 'carrier', tone: 'danger', detail: 'Carrier lands on his chest; both players grounded.' },
        { id: 'stop', label: 'Slide arrested', short: 'STOP', t: CONTACT_T + 0.99, lane: 'tackler', tone: 'neutral', detail: 'Tackler’s momentum is arrested by turf friction after 3.1 m.' },
        { id: 'whistle', label: 'Referee whistle', short: 'WHISTLE', t: WHISTLE_T, lane: 'official', tone: 'neutral', detail: 'The referee stops play one second after contact; VAR review begins.' },
        { id: 'up', label: 'Tackler back up', short: 'RISE', t: CONTACT_T + 1.22, lane: 'tackler', tone: 'neutral', detail: 'Tackler regains his feet; carrier remains seated.' },
    ];
    return {
        frames,
        duration,
        contactT: CONTACT_T,
        impact,
        events,
        meta: {
            masses: { tackler: 82, carrier: 76, ball: 0.43 },
            friction: { grassSliding: 0.57, boots: 0.74, ball: 0.55 },
            gravity: G,
            seed: 7829,
            speed: {
                tackler: Math.round(speedAtContact * 100) / 100,
                carrier: Math.round(bSpeedAtContact * 100) / 100,
                closing: Math.round(closingSpeed * 100) / 100,
            },
        },
    };
}
export function sampleFrame(sim, time) {
    const t = clamp(time, 0, sim.duration);
    const f = t / dt;
    const i0 = Math.floor(f);
    const i1 = Math.min(sim.frames.length - 1, i0 + 1);
    const k = f - i0;
    const a = sim.frames[i0];
    const b = sim.frames[i1];
    if (i0 === i1)
        return a;
    const mix = (p, q) => p + (q - p) * k;
    const mixV = (p, q) => ({ x: mix(p.x, q.x), y: mix(p.y, q.y), z: mix(p.z, q.z) });
    return {
        t,
        tackler: {
            ...a.tackler,
            x: mix(a.tackler.x, b.tackler.x),
            z: mix(a.tackler.z, b.tackler.z),
            yaw: mix(a.tackler.yaw, b.tackler.yaw),
            speed: mix(a.tackler.speed, b.tackler.speed),
            pitch: mix(a.tackler.pitch, b.tackler.pitch),
            roll: mix(a.tackler.roll, b.tackler.roll),
            comY: mix(a.tackler.comY, b.tackler.comY),
            stride: mix(a.tackler.stride, b.tackler.stride),
            leadFoot: mixV(a.tackler.leadFoot, b.tackler.leadFoot),
            trailFoot: mixV(a.tackler.trailFoot, b.tackler.trailFoot),
        },
        carrier: {
            ...a.carrier,
            x: mix(a.carrier.x, b.carrier.x),
            z: mix(a.carrier.z, b.carrier.z),
            yaw: mix(a.carrier.yaw, b.carrier.yaw),
            speed: mix(a.carrier.speed, b.carrier.speed),
            pitch: mix(a.carrier.pitch, b.carrier.pitch),
            roll: mix(a.carrier.roll, b.carrier.roll),
            comY: mix(a.carrier.comY, b.carrier.comY),
            brace: mix(a.carrier.brace, b.carrier.brace),
            stride: mix(a.carrier.stride, b.carrier.stride),
            leadFoot: mixV(a.carrier.leadFoot, b.carrier.leadFoot),
            trailFoot: mixV(a.carrier.trailFoot, b.carrier.trailFoot),
        },
        ball: {
            ...b.ball,
            p: mixV(a.ball.p, b.ball.p),
            v: mixV(a.ball.v, b.ball.v),
            spin: mixV(a.ball.spin, b.ball.spin),
        },
        impact: a.impact ?? b.impact,
        aTrail: a.aTrail,
        bTrail: a.bTrail,
    };
}
