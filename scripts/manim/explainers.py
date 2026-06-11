"""
Animated paper explainers for the three front-page (featured) papers.  (v4)

Design rules (learned from v3, which read as crude at card scale):
  * The card displays at ~160-192 px square. Frame is 8 units, so 1 unit is
    ~20 px on screen. HARD FLOOR: font_size 44 for micro labels, 48+ for
    content, 56+ for primary lines. Strokes 8+. Max ~6 elements on screen.
  * Lines of text stay under ~18 characters; split to two lines instead of
    shrinking.
  * FRAME 0 IS THE POSTER: each scene opens on a fully composed title
    diagram (held ~1 s) which is also exported as the card's static image.
    Each scene ends by restoring the poster so the hover loop is seamless.
  * Real data and real examples from the papers. No em dashes.

Scenes:
  LLMDistractors      who writes the wrong answers, graded on 3 axes
  TestTimeReasoners   hidden question, inferred question, 56% vs 25%
  FillerGap           filler-gap arc, DAS injection, emergence vs children

Render: manim explainers.py <Scene>
Poster: ffmpeg -i <Scene>.mp4 -frames:v 1 poster.png
"""

from manim import *
import numpy as np

config.background_color = "#FDF8F3"
config.pixel_width = 1600
config.pixel_height = 1600
config.frame_height = 8.0
config.frame_width = 8.0
config.frame_rate = 30

SANS = "Avenir Next"

INK    = "#1A1A1A"
INK2   = "#4A4A4A"
INK3   = "#9A9A9A"
WHT    = "#FFFFFF"
CREAM  = "#FDF8F3"
ACCENT = "#E85D4C"
ACCENTD= "#C9462F"
GREEN  = "#3D7A55"
BLUE   = "#3A6A91"
GOLD   = "#B07A12"


def text_line(s, fs=48, color=INK, t2c=None):
    # Rendering each line separately keeps Pango's kerning intact while avoiding
    # the loose multiline leading Manim applies at this card scale.
    return Text(
        s,
        font=SANS,
        font_size=fs,
        color=color,
        weight=BOLD,
        t2c=(t2c or {}),
        disable_ligatures=False,
    )


def txt(s, fs=48, color=INK, t2c=None, line_buff=0.08):
    if "\n" not in s:
        return text_line(s, fs=fs, color=color, t2c=t2c)

    lines = [
        text_line(line, fs=fs, color=color, t2c=t2c)
        for line in s.split("\n")
    ]
    return VGroup(*lines).arrange(DOWN, buff=line_buff)


def fit(mob, w=7.3, h=7.3):
    if mob.width > w:
        mob.scale_to_fit_width(w)
    if mob.height > h:
        mob.scale_to_fit_height(h)
    return mob


def part(text_mobj, full_str, sub):
    ns = full_str.replace(" ", "").replace("\n", "")
    s = ns.index(sub.replace(" ", ""))
    return text_mobj[s:s + len(sub.replace(" ", ""))]


def box_row(width=7.0, height=0.82, fill=WHT, fill_op=0.0, stroke=INK2,
            sw=5, radius=0.16, dashed=False):
    r = RoundedRectangle(corner_radius=radius, width=width, height=height,
                         fill_color=fill, fill_opacity=fill_op,
                         stroke_color=stroke, stroke_width=sw)
    if dashed:
        return DashedVMobject(r, num_dashes=42, dashed_ratio=0.62)
    return r


def wipe(scene, rt=0.5):
    if scene.mobjects:
        scene.play(*[FadeOut(m) for m in scene.mobjects], run_time=rt)


def outro(scene, line, graphic, fs=48):
    t = txt(line, fs=fs)
    fit(t, w=7.0)
    grp = VGroup(graphic, t).arrange(DOWN, buff=0.65)
    fit(grp, w=7.1, h=6.2).move_to(ORIGIN)
    wipe(scene)
    scene.play(FadeIn(graphic, shift=UP * 0.2), run_time=0.55)
    scene.play(FadeIn(t, shift=UP * 0.2), run_time=0.55)
    scene.wait(1.5)


def close_on_poster(scene, poster):
    """Fade back to the poster so the looping video ends on frame 0."""
    wipe(scene, rt=0.5)
    scene.play(FadeIn(poster), run_time=0.6)
    scene.wait(0.8)


# =============================================================================
# 1.  Quick, Create a Distractor!  (who writes the wrong answers?)
# =============================================================================
class LLMDistractors(Scene):
    SLOT_Y = [0.35, -0.65, -1.65]

    def poster(self):
        q = txt("What best describes\nskin?", fs=48, line_buff=0.06)
        fit(q, w=7.15).move_to(UP * 3.05)
        ans = box_row(stroke=GREEN, sw=6, fill=GREEN, fill_op=0.12)
        ans.move_to(UP * 1.45)
        at = txt("flexible", fs=48, color=GREEN)
        at.move_to(ans).align_to(ans.get_left() + RIGHT * 0.5, LEFT)
        ck = txt("✓", fs=48, color=GREEN)
        ck.move_to(ans).align_to(ans.get_right() + LEFT * 0.5, RIGHT)
        slots = VGroup()
        for y in self.SLOT_Y:
            b = box_row(stroke=INK3, dashed=True).move_to(UP * y)
            qm = txt("?", fs=48, color=INK3).move_to(b)
            slots.add(VGroup(b, qm))
        cap = txt("who writes the\nwrong answers?", fs=50, color=ACCENTD, line_buff=0.08)
        cap.move_to(DOWN * 3.05)
        return VGroup(q, ans, at, ck, slots, cap)

    def construct(self):
        poster = self.poster()
        self.add(poster)
        self.wait(1.0)

        q, ans, at, ck, slots, cap = poster

        # ---- Beat 1: humans write them (real items from the paper) ------
        human = txt("people write them", fs=50, color=BLUE).move_to(DOWN * 3.05)
        words = ["stiff", "brittle", "hard"]
        h_boxes, h_anims = VGroup(), []
        for (b, qm), w, y in zip(slots, words, self.SLOT_Y):
            nb = box_row(stroke=BLUE, sw=6).move_to(UP * y)
            wt = txt(w, fs=48, color=BLUE)
            wt.move_to(nb).align_to(nb.get_left() + RIGHT * 0.5, LEFT)
            h_boxes.add(VGroup(nb, wt))
            h_anims += [FadeOut(b), FadeOut(qm), FadeIn(nb), FadeIn(wt)]
        self.play(FadeOut(cap), FadeIn(human), run_time=0.45)
        self.play(LaggedStart(*h_anims, lag_ratio=0.06), run_time=1.0)
        self.wait(0.9)

        # ---- Beat 2: or an LLM, instantly --------------------------------
        llm = txt("or an LLM, instantly", fs=50, color=ACCENTD).move_to(DOWN * 3.05)
        r_boxes, r_anims = VGroup(), []
        widths = [3.6, 4.6, 2.9]
        for (nb, wt), bw, y in zip(h_boxes, widths, self.SLOT_Y):
            rb = box_row(stroke=ACCENT, sw=6).move_to(UP * y)
            bar = RoundedRectangle(corner_radius=0.12, width=bw, height=0.4,
                                   fill_color=ACCENT, fill_opacity=0.85,
                                   stroke_width=0)
            bar.move_to(rb).align_to(rb.get_left() + RIGHT * 0.5, LEFT)
            r_boxes.add(VGroup(rb, bar))
            r_anims += [FadeOut(nb), FadeOut(wt), FadeIn(rb), FadeIn(bar)]
        self.play(FadeOut(human), FadeIn(llm), run_time=0.45)
        self.play(LaggedStart(*r_anims, lag_ratio=0.06), run_time=0.9)
        self.wait(0.9)

        # ---- Beat 3: graded on 3 axes (the paper's trade-off) ------------
        wipe(self)
        head = txt("graded on 3 axes", fs=52).move_to(UP * 3.2)
        leg = VGroup(
            Square(0.34, fill_color=BLUE, fill_opacity=1, stroke_width=0),
            txt("human", fs=44, color=BLUE),
            Square(0.34, fill_color=ACCENT, fill_opacity=1, stroke_width=0),
            txt("LLM", fs=44, color=ACCENTD),
        ).arrange(RIGHT, buff=0.28).move_to(UP * 2.45)
        self.play(FadeIn(head), FadeIn(leg), run_time=0.5)

        rows = [
            ("harder MCQs", 4.0, 5.9, "LLM"),
            ("ranks models", 5.9, 4.2, "human"),
            ("well written", 5.7, 4.0, "human"),
        ]
        x0 = -3.45
        groups = []
        for i, (label, bh, bl, win) in enumerate(rows):
            yt = 1.55 - i * 1.65
            lab = txt(label, fs=48).move_to([x0 + 0.0, yt, 0], aligned_edge=LEFT)
            hb = RoundedRectangle(corner_radius=0.1, width=bh, height=0.34,
                                  fill_color=BLUE, fill_opacity=1, stroke_width=0)
            rb = RoundedRectangle(corner_radius=0.1, width=bl, height=0.34,
                                  fill_color=ACCENT, fill_opacity=1, stroke_width=0)
            hb.move_to([x0 + bh / 2, yt - 0.52, 0])
            rb.move_to([x0 + bl / 2, yt - 0.96, 0])
            wmark = txt("✓", fs=44, color=(ACCENTD if win == "LLM" else BLUE))
            wmark.next_to(rb if win == "LLM" else hb, RIGHT, buff=0.18)
            groups.append((lab, hb, rb, wmark))
        for lab, hb, rb, wmark in groups:
            self.play(FadeIn(lab), GrowFromEdge(hb, LEFT),
                      GrowFromEdge(rb, LEFT), run_time=0.55)
            self.play(FadeIn(wmark, scale=1.4), run_time=0.25)
        self.wait(1.2)

        # ---- Outro --------------------------------------------------------
        g = VGroup(
            Circle(radius=0.26, fill_color=ACCENT, fill_opacity=1, stroke_width=0),
            txt("+", fs=54, color=INK2),
            Circle(radius=0.26, fill_color=BLUE, fill_opacity=1, stroke_width=0),
        ).arrange(RIGHT, buff=0.3)
        outro(self, "LLMs scale the questions.\nHumans keep them honest.", g)

        close_on_poster(self, self.poster())


# =============================================================================
# 2.  Test-Time Reasoners Are Strategic Multiple-Choice Test-Takers
# =============================================================================
class TestTimeReasoners(Scene):
    CHOICE_Y = [1.56, 0.52, -0.52, -1.56]
    ITEMS = [("A", "car engine"), ("B", "refrigerator"),
             ("C", "frying pan"), ("D", "glass bottle")]

    def poster(self):
        qbar = RoundedRectangle(corner_radius=0.16, width=7.0, height=1.0,
                                fill_color=INK, fill_opacity=0.92,
                                stroke_width=0).move_to(UP * 2.85)
        qmk = txt("? ? ?", fs=52, color=CREAM).move_to(qbar)
        choices = VGroup()
        for (L, w), y in zip(self.ITEMS, self.CHOICE_Y):
            b = box_row(height=0.9).move_to(UP * y)
            lt = txt(L, fs=46, color=INK2)
            lt.move_to(b).align_to(b.get_left() + RIGHT * 0.45, LEFT)
            wt = txt(w, fs=48)
            wt.move_to(b).align_to(b.get_left() + RIGHT * 1.35, LEFT)
            choices.add(VGroup(b, lt, wt))
        cap = txt("answer it without\nthe question?", fs=50, color=ACCENTD, line_buff=0.08)
        cap.move_to(DOWN * 3.04)
        return VGroup(qbar, qmk, choices, cap)

    def construct(self):
        poster = self.poster()
        self.add(poster)
        self.wait(1.0)

        qbar, qmk, choices, cap = poster

        # ---- Beat 1: the reasoner infers the hidden question -------------
        think = txt("it reasons, then\ninfers the question", fs=50, color=ACCENTD, line_buff=0.08)
        think.move_to(DOWN * 3.04)
        self.play(FadeOut(cap), FadeIn(think), run_time=0.45)

        guess = txt("what makes heat?", fs=50, color=CREAM).move_to(qbar)
        fit(guess, w=6.4)
        self.play(FadeOut(qmk, shift=UP * 0.2),
                  FadeIn(guess, shift=UP * 0.2), run_time=0.6)
        self.wait(0.7)

        pick = choices[0]
        ck = txt("✓", fs=52, color=GREEN)
        ck.move_to(pick[0]).align_to(pick[0].get_right() + LEFT * 0.45, RIGHT)
        self.play(pick[0].animate.set_stroke(GREEN, 7).set_fill(GREEN, 0.12),
                  pick[1].animate.set_color(GREEN),
                  pick[2].animate.set_color(GREEN),
                  *[c.animate.set_opacity(0.35) for c in choices[1:]],
                  FadeIn(ck, scale=1.5), run_time=0.7)
        self.wait(1.0)

        # ---- Beat 2: far above chance (GPT-5 on ARC, real numbers) -------
        wipe(self)
        head = txt("accuracy, no question", fs=50).move_to(UP * 3.2)
        fit(head, w=7.2)
        self.play(FadeIn(head), run_time=0.4)

        base_y = -2.0
        unit = 4.4 / 100.0
        spec = [("random", 25, INK3, -1.9), ("GPT-5", 56, ACCENT, 1.9)]
        axis = Line([-3.6, base_y, 0], [3.6, base_y, 0], color=INK2, stroke_width=6)
        self.play(Create(axis), run_time=0.3)
        for name, val, col, cx in spec:
            bar = RoundedRectangle(corner_radius=0.12, width=2.3,
                                   height=val * unit, fill_color=col,
                                   fill_opacity=1, stroke_width=0)
            bar.move_to([cx, base_y + val * unit / 2, 0])
            num = txt(f"{val}%", fs=64, color=(INK2 if col == INK3 else ACCENTD))
            num.next_to(bar, UP, buff=0.22)
            lab = txt(name, fs=46, color=INK2).move_to([cx, base_y - 0.55, 0])
            self.play(GrowFromEdge(bar, DOWN), run_time=0.6)
            self.play(FadeIn(num), FadeIn(lab), run_time=0.35)
        self.wait(1.3)

        # ---- Outro --------------------------------------------------------
        gbar = RoundedRectangle(corner_radius=0.12, width=2.4, height=0.66,
                                fill_color=INK, fill_opacity=0.92, stroke_width=0)
        gq = txt("?", fs=42, color=CREAM).move_to(gbar)
        gck = txt("✓", fs=48, color=GREEN).next_to(gbar, RIGHT, buff=0.3)
        outro(self, "Not always a flaw.\nTraces show the strategy.",
              VGroup(gbar, gq, gck))

        close_on_poster(self, self.poster())


# =============================================================================
# 3.  Filling in the Mechanisms (filler-gap under developmental constraints)
# =============================================================================
class FillerGap(Scene):
    def poster(self):
        s = "Who did the teacher like __?"
        sent = txt(s, fs=46, t2c={"Who": BLUE, "__": INK3})
        fit(sent, w=7.55)
        sent.move_to(UP * 0.85)
        filler = part(sent, s, "Who")
        gap = part(sent, s, "__")
        arc = CurvedArrow(filler.get_top() + UP * 0.3, gap.get_top() + UP * 0.3,
                          angle=-TAU / 4.6, color=ACCENT, stroke_width=10,
                          tip_length=0.34)
        flab = txt("filler", fs=46, color=BLUE).next_to(filler, DOWN, buff=0.42)
        glab = txt("gap", fs=46, color=INK3).next_to(gap, DOWN, buff=0.42)
        cap = txt("learnable from a\nchild's input?", fs=52, color=ACCENTD, line_buff=0.08)
        cap.move_to(DOWN * 2.78)
        return VGroup(sent, arc, flab, glab, cap)

    def construct(self):
        poster = self.poster()
        self.add(poster)
        self.wait(1.0)

        # ---- Beat 1: DAS injection flips the prediction -------------------
        wipe(self)
        head = txt("inject the filler signal", fs=50).move_to(UP * 3.2)
        fit(head, w=7.2)
        neurons = VGroup(*[Circle(radius=0.5, stroke_color=INK2, stroke_width=6,
                                  fill_color=WHT, fill_opacity=1)
                           for _ in range(5)])
        neurons.arrange(RIGHT, buff=0.42).move_to(UP * 1.35)
        self.play(FadeIn(head),
                  LaggedStart(*[GrowFromCenter(n) for n in neurons],
                              lag_ratio=0.08), run_time=0.8)

        chip_t = txt("filler", fs=48, color=WHT)
        chip_b = RoundedRectangle(corner_radius=0.16, width=chip_t.width + 0.7,
                                  height=chip_t.height + 0.5, fill_color=GREEN,
                                  fill_opacity=1, stroke_width=0)
        chip = VGroup(chip_b, chip_t.move_to(chip_b)).move_to(DOWN * 0.85)
        vec = Arrow(chip.get_top(), neurons[2].get_bottom(), buff=0.14,
                    color=GREEN, stroke_width=10,
                    max_tip_length_to_length_ratio=0.3)
        self.play(FadeIn(chip, shift=UP * 0.2), GrowArrow(vec), run_time=0.65)
        self.play(neurons[2].animate.set_fill(GREEN, 1).set_stroke(GREEN, 6),
                  Flash(neurons[2], color=GREEN, flash_radius=0.9),
                  run_time=0.65)

        him = txt("him", fs=56, color=INK3)
        arr = Arrow(ORIGIN, RIGHT * 1.1, buff=0, color=INK2, stroke_width=9,
                    max_tip_length_to_length_ratio=0.35)
        gp = txt("__ ?", fs=56, color=ACCENTD)
        flip = VGroup(him, arr, gp).arrange(RIGHT, buff=0.45).move_to(DOWN * 2.65)
        strike = Line(him.get_left() + LEFT * 0.08 + UP * 0.06,
                      him.get_right() + RIGHT * 0.08 + UP * 0.06,
                      color=ACCENTD, stroke_width=7)
        self.play(FadeIn(flip), run_time=0.5)
        self.play(Create(strike), run_time=0.45)
        self.wait(1.0)

        # ---- Beat 2: emerges with data, far later than children -----------
        wipe(self)
        head2 = txt("it emerges with data", fs=50).move_to(UP * 3.2)
        fit(head2, w=7.2)
        o = np.array([-3.2, -2.5, 0])
        xax = Arrow(o, o + RIGHT * 6.7, buff=0, stroke_width=7, color=INK2,
                    max_tip_length_to_length_ratio=0.035)
        yax = Arrow(o, o + UP * 5.0, buff=0, stroke_width=7, color=INK2,
                    max_tip_length_to_length_ratio=0.05)
        ticks = VGroup(
            txt("1M", fs=40, color=INK3).move_to(o + RIGHT * 0.35 + DOWN * 0.42),
            txt("10M", fs=40, color=INK3).move_to(o + RIGHT * 3.1 + DOWN * 0.42),
            txt("100M", fs=40, color=INK3).move_to(o + RIGHT * 5.9 + DOWN * 0.42),
        )
        xlab = txt("training words", fs=42, color=INK2)
        xlab.move_to(o + RIGHT * 3.3 + DOWN * 1.05)
        self.play(FadeIn(head2), GrowArrow(xax), GrowArrow(yax),
                  FadeIn(ticks), FadeIn(xlab), run_time=0.7)

        # Fig. 3 shape: MAX ODDS ~0.8 @1M, ~3 @10M, ~10.6 @100M (log x)
        def fx(tokens_log):       # 6 (=1M) .. 8 (=100M)  ->  0 .. 5.55
            return (tokens_log - 6.0) / 2.0 * 5.55 + 0.35
        def fy(odds):             # 0 .. 11  ->  0 .. 4.2
            return odds / 11.0 * 4.2 + 0.12
        data = [(6.0, 0.8), (6.3, 1.0), (6.7, 1.6), (7.0, 2.8),
                (7.3, 4.2), (7.7, 7.3), (8.0, 10.6)]
        pts = [o + RIGHT * fx(t) + UP * fy(v) for t, v in data]
        curve = VMobject(stroke_color=ACCENT, stroke_width=10)
        curve.set_points_smoothly(pts)

        kid_x = fx(7.0)
        kid_line = DashedLine(o + RIGHT * kid_x, o + RIGHT * kid_x + UP * 4.6,
                              color=GREEN, stroke_width=6, dash_length=0.14)
        kid_lab = txt("kids: age 3 ✓", fs=44, color=GREEN)
        kid_lab.move_to(o + RIGHT * kid_x + UP * 4.95)
        if kid_lab.get_right()[0] > 3.7:
            kid_lab.shift(LEFT * (kid_lab.get_right()[0] - 3.7))

        self.play(Create(curve), run_time=1.5, rate_func=linear)
        end_dot = Dot(curve.get_end(), color=ACCENT, radius=0.13)
        lm_lab = txt("LM", fs=44, color=ACCENTD)
        lm_lab.next_to(end_dot, UP, buff=0.2)
        if lm_lab.get_right()[0] > 3.75:
            lm_lab.shift(LEFT * (lm_lab.get_right()[0] - 3.75))
        self.play(FadeIn(end_dot), FadeIn(lm_lab), run_time=0.3)
        self.play(Create(kid_line), FadeIn(kid_lab), run_time=0.7)
        self.wait(1.4)

        # ---- Outro --------------------------------------------------------
        og = np.array([-1.3, -0.5, 0])
        gcurve = VMobject(stroke_color=ACCENT, stroke_width=10)
        gcurve.set_points_smoothly(
            [og + RIGHT * x + UP * (1.3 * (x / 2.6) ** 1.7)
             for x in np.linspace(0, 2.6, 20)])
        gtip = Arrow(gcurve.points[-3],
                     gcurve.get_end() + RIGHT * 0.06 + UP * 0.06, buff=0,
                     color=ACCENT, stroke_width=10,
                     max_tip_length_to_length_ratio=1.2)
        outro(self, "It emerges, but needs far\nmore data than kids do.",
              VGroup(gcurve, gtip))

        close_on_poster(self, self.poster())
