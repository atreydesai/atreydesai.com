"""
Animated paper explainers for the three front-page (featured) papers.  (v3)

Design rules:
  * No paper-title text (it sits beside the card).
  * Figure-first, full-bleed: thin margins, large elements filling the square.
  * BOLD weights throughout (thin text aliases / looks pixelated).
  * Strict alignment: uniform chip widths, left-aligned columns, single Text
    phrases (Pango kerning), arcs anchored to glyph slices.
  * Real data / real figures from the papers.
  * No em dashes anywhere.
  * Every outro pairs the closing line with a small graphic.

Scenes:
  LLMDistractors      animated Figure 1 (mcqa_generation)
  TestTimeReasoners   choices-only MCQ + real accuracy bars (2510.07761)
  FillerGap           dependency arc + DAS probe + Fig. 3 trajectory (2604.14459)

Render: manim explainers.py <Scene>
"""

from manim import *
import numpy as np

config.background_color = "#FDF8F3"
config.pixel_width = 1600
config.pixel_height = 1600
config.frame_height = 8.0
config.frame_width = 8.0
config.frame_rate = 30

SANS = "Helvetica Neue"

INK    = "#1A1A1A"
INK2   = "#4A4A4A"
INK3   = "#9A9A9A"
TRACK  = "#E2D4C4"
WHT    = "#FFFFFF"
ACCENT = "#E85D4C"
ACCENTD= "#C9462F"
GREEN  = "#3D7A55"
BLUE   = "#3A6A91"
GOLD   = "#B07A12"
PLUM   = "#6F4476"

MARGIN = 3.7   # usable half-extent (frame half is 4.0 -> ~0.3 margin)


def txt(s, fs=40, color=INK, weight=BOLD, t2c=None, font=SANS):
    return Text(s, font=font, font_size=fs, color=color, weight=weight,
                t2c=(t2c or {}))


def fit(mob, w=7.3, h=7.3):
    if mob.width > w:
        mob.scale_to_fit_width(w)
    if mob.height > h:
        mob.scale_to_fit_height(h)
    return mob


def part(text_mobj, full_str, sub):
    ns = full_str.replace(" ", "")
    s = ns.index(sub.replace(" ", ""))
    return text_mobj[s:s + len(sub.replace(" ", ""))]


def dot(color, filled=True, r=0.17, sw=5):
    if filled:
        return Circle(radius=r, fill_color=color, fill_opacity=1, stroke_width=0)
    return Circle(radius=r, fill_opacity=0, stroke_color=color, stroke_width=sw)


def chip(label, fill, text_color=WHT, fs=38, pad_w=0.6, pad_h=0.42, radius=0.16,
         fill_opacity=1.0, stroke=None, sw=4):
    t = txt(label, fs=fs, color=text_color, weight=BOLD)
    box = RoundedRectangle(corner_radius=radius, width=t.width + pad_w,
                           height=t.height + pad_h, fill_color=fill,
                           fill_opacity=fill_opacity,
                           stroke_color=(stroke if stroke is not None else fill),
                           stroke_width=sw)
    t.move_to(box.get_center())
    return VGroup(box, t)


def outro(scene, line, graphic, fs=44):
    t = txt(line, fs=fs, color=INK, weight=BOLD)
    fit(t, w=6.9)
    grp = VGroup(graphic, t).arrange(DOWN, buff=0.7)
    fit(grp, w=7.0, h=6.0)
    grp.move_to(ORIGIN)
    if scene.mobjects:
        scene.play(*[FadeOut(m) for m in scene.mobjects], run_time=0.5)
    scene.play(FadeIn(graphic, shift=UP * 0.2), run_time=0.6)
    scene.play(FadeIn(t, shift=UP * 0.2), run_time=0.6)
    scene.wait(1.6)
    scene.play(FadeOut(grp), run_time=0.55)
    scene.wait(0.25)


# =============================================================================
# 1.  Animated Figure 1 — building the 4 distractor types, then grading them
# =============================================================================
class LLMDistractors(Scene):
    def construct(self):
        self.wait(0.3)

        # ---- Beat A: a benchmark MCQ needs distractors ------------------
        q = txt("What best describes skin?", fs=44, weight=BOLD)
        fit(q, w=7.0).move_to(UP * 2.7)
        dots = VGroup(dot(GREEN, True, r=0.4),
                      dot(INK3, False, r=0.4, sw=5),
                      dot(INK3, False, r=0.4, sw=5),
                      dot(INK3, False, r=0.4, sw=5)).arrange(RIGHT, buff=0.7)
        dots.move_to(UP * 0.4)
        a_ans = txt("answer", fs=26, color=GREEN, weight=BOLD).next_to(dots[0], DOWN, buff=0.35)
        a_dis = txt("distractors", fs=26, color=INK2, weight=BOLD)
        a_dis.next_to(dots[1:], DOWN, buff=0.35)
        self.play(Write(q), run_time=0.9)
        self.play(LaggedStart(*[GrowFromCenter(d) for d in dots], lag_ratio=0.15),
                  run_time=0.9)
        self.play(FadeIn(a_ans), FadeIn(a_dis), run_time=0.5)
        self.wait(0.7)

        cap = txt("Who writes them, and how?", fs=30, color=ACCENTD, weight=BOLD)
        cap.move_to(DOWN * 2.7)
        self.play(FadeIn(cap), run_time=0.5)
        self.wait(0.6)
        self.play(*[FadeOut(m) for m in self.mobjects], run_time=0.5)

        # ---- Beat B: the 4 types (human/LLM x generation/extension) -----
        def type_row(tag, tag_color, src_color, extended, y):
            d = [dot(GREEN, True)] + [dot(src_color, True) for _ in range(3)]
            if extended:
                d += [dot(src_color, False) for _ in range(2)]
            drow = VGroup(*d).arrange(RIGHT, buff=0.26)
            lab = txt(tag, fs=26, color=tag_color, weight=BOLD)
            lab.move_to([-1.55 - lab.width / 2, y, 0])      # right edge ~ -1.55
            drow.move_to([-1.15 + drow.width / 2, y, 0])    # left edge  ~ -1.15
            return VGroup(lab, drow)

        rows = VGroup(
            type_row("human gen", BLUE, BLUE, False, 2.15),
            type_row("human ext", BLUE, BLUE, True, 0.85),
            type_row("LLM gen", ACCENT, ACCENT, False, -0.45),
            type_row("LLM ext", ACCENT, ACCENT, True, -1.75),
        )
        # legend
        def leg_item(sym, label):
            return VGroup(sym, txt(label, fs=22, color=INK2, weight=BOLD)
                          ).arrange(RIGHT, buff=0.2)
        legend = VGroup(
            leg_item(dot(GREEN, True, r=0.15), "answer"),
            leg_item(dot(BLUE, True, r=0.15), "human"),
            leg_item(dot(ACCENT, True, r=0.15), "LLM"),
            leg_item(dot(INK2, False, r=0.15, sw=4), "extended"),
        ).arrange(RIGHT, buff=0.55)
        fit(legend, w=7.2).move_to(DOWN * 3.1)

        self.play(LaggedStart(*[FadeIn(r[0], shift=RIGHT * 0.2) for r in rows],
                              lag_ratio=0.15), run_time=0.7)
        self.play(LaggedStart(*[LaggedStart(*[GrowFromCenter(x) for x in r[1]],
                                            lag_ratio=0.12) for r in rows],
                              lag_ratio=0.25), run_time=1.6)
        self.play(FadeIn(legend), run_time=0.5)
        four = txt("4 ways to build the MCQ", fs=30, color=INK, weight=BOLD).move_to(UP * 3.35)
        self.play(FadeIn(four), run_time=0.4)
        self.wait(1.0)

        # ---- Beat C: every MCQ graded on 3 axes -------------------------
        self.play(*[FadeOut(m) for m in self.mobjects], run_time=0.5)

        head = txt("Graded on 3 axes", fs=34, weight=BOLD).move_to(UP * 3.2)
        self.play(FadeIn(head), run_time=0.4)

        def diff_icon():
            bars = VGroup(*[Rectangle(width=0.22, height=h, fill_color=ACCENT,
                                      fill_opacity=1, stroke_width=0)
                            for h in (0.3, 0.55, 0.85)]).arrange(RIGHT, buff=0.12,
                                                                 aligned_edge=DOWN)
            return bars

        def disc_icon():
            up = Arrow(ORIGIN, RIGHT * 0.7 + UP * 0.45, buff=0, color=BLUE, stroke_width=7,
                       max_tip_length_to_length_ratio=0.3)
            dn = Arrow(ORIGIN, RIGHT * 0.7 + DOWN * 0.45, buff=0, color=INK3, stroke_width=7,
                       max_tip_length_to_length_ratio=0.3)
            return VGroup(up, dn)

        def qual_icon():
            c = Circle(radius=0.42, stroke_color=GREEN, stroke_width=7, fill_opacity=0)
            ck = txt("✓", fs=40, color=GREEN, weight=BOLD).move_to(c)
            return VGroup(c, ck)

        def card(title, sub, icon):
            box = RoundedRectangle(corner_radius=0.2, width=2.18, height=3.0,
                                   fill_color=WHT, fill_opacity=0.7,
                                   stroke_color=INK2, stroke_width=3)
            ic = icon.copy().move_to(box.get_top() + DOWN * 0.85)
            tt = txt(title, fs=27, weight=BOLD)
            fit(tt, w=1.95).move_to(box.get_center() + DOWN * 0.25)
            st = txt(sub, fs=21, color=INK2, weight=BOLD)
            fit(st, w=1.95).next_to(tt, DOWN, buff=0.22)
            return VGroup(box, ic, tt, st)

        cards = VGroup(
            card("Difficulty", "how hard?", diff_icon()),
            card("Discrimina-\ntion", "tells models\napart?", disc_icon()),
            card("Writing\nquality", "valid MCQ?", qual_icon()),
        ).arrange(RIGHT, buff=0.45)
        fit(cards, w=7.3).move_to(DOWN * 0.4)

        self.play(LaggedStart(*[FadeIn(c, shift=UP * 0.25) for c in cards],
                              lag_ratio=0.2), run_time=1.1)
        self.wait(1.2)

        g = VGroup(dot(GREEN, True, r=0.22), dot(BLUE, True, r=0.22),
                   dot(ACCENT, True, r=0.22), dot(ACCENT, False, r=0.22, sw=5),
                   txt("✓", fs=44, color=GREEN, weight=BOLD)).arrange(RIGHT, buff=0.3)
        outro(self, "LLMs scale distractors,\nwith human oversight.", g, fs=44)


# =============================================================================
# 2.  Answering without the question: above chance (real ARC numbers)
# =============================================================================
class TestTimeReasoners(Scene):
    def construct(self):
        self.wait(0.3)

        # ---- Beat A: hidden question, choices only ----------------------
        qbar = RoundedRectangle(corner_radius=0.18, width=7.0, height=1.1,
                                fill_color=INK, fill_opacity=0.9, stroke_width=0)
        qmk = txt("?", fs=68, color="#FDF8F3", weight=BOLD).move_to(qbar)
        qrow = VGroup(qbar, qmk).move_to(UP * 2.55)

        items = [("A", "car engine"), ("B", "refrigerator"),
                 ("C", "frying pan"), ("D", "glass bottle")]
        CW, CH = 7.0, 1.06
        choices = VGroup()
        for L, w in items:
            box = RoundedRectangle(corner_radius=0.16, width=CW, height=CH,
                                   fill_color=WHT, fill_opacity=0.0,
                                   stroke_color=INK2, stroke_width=3)
            lt = txt(L, fs=38, color=INK, weight=BOLD)
            wd = txt(w, fs=38, color=INK, weight=BOLD)
            lt.move_to(box.get_left() + RIGHT * 0.75).set_y(box.get_y())
            wd.move_to(box.get_left() + RIGHT * 2.2).set_y(box.get_y()).align_to(
                box.get_left() + RIGHT * 1.7, LEFT)
            choices.add(VGroup(box, lt, wd))
        choices.arrange(DOWN, buff=0.30).next_to(qrow, DOWN, buff=0.55)

        self.play(FadeIn(qrow, shift=DOWN * 0.15), run_time=0.5)
        self.play(LaggedStart(*[FadeIn(c, shift=UP * 0.15) for c in choices],
                              lag_ratio=0.15), run_time=0.9)
        self.wait(0.5)

        pick = choices[0]
        check = txt("✓", fs=52, color=GREEN, weight=BOLD)
        check.next_to(pick, RIGHT, buff=0.0).shift(LEFT * 0.0)
        check.move_to(pick[0].get_right() + RIGHT * 0.05).align_to(pick, RIGHT).shift(RIGHT * 0.55)
        self.play(pick[0].animate.set_stroke(GREEN, 6).set_fill(GREEN, 0.14),
                  pick[1].animate.set_color(GREEN), pick[2].animate.set_color(GREEN),
                  FadeIn(check, scale=1.4), run_time=0.7)
        self.wait(0.8)

        # ---- Beat B: accuracy far above chance (clean bars) -------------
        self.play(*[FadeOut(m) for m in self.mobjects], run_time=0.5)

        head = txt("MCQ accuracy", fs=40, weight=BOLD).move_to(UP * 3.25)
        self.play(FadeIn(head), run_time=0.4)

        spec = [("Random", 25, INK3), ("Choices\nonly", 56, ACCENT),
                ("Full\nquestion", 90, BLUE)]
        unit = 4.2 / 100.0
        bw = 1.35
        base_y = -2.55
        bars, nums, labs = [], [], []
        xs = [-2.55, 0.0, 2.55]
        for (name, val, col), cx in zip(spec, xs):
            bar = Rectangle(width=bw, height=val * unit, fill_color=col,
                            fill_opacity=1, stroke_width=0)
            bar.move_to([cx, base_y + val * unit / 2, 0])
            num = txt(f"{val}%", fs=42, color=(INK2 if col == INK3 else col),
                      weight=BOLD).next_to(bar, UP, buff=0.18)
            lab = txt(name, fs=30, color=INK2, weight=BOLD).move_to([cx, base_y - 0.55, 0])
            bars.append(bar); nums.append(num); labs.append(lab)
        axis = Line([-3.5, base_y, 0], [3.5, base_y, 0], color=INK2, stroke_width=4)

        self.play(Create(axis), run_time=0.35)
        self.play(*[GrowFromEdge(b, DOWN) for b in bars], run_time=1.0)
        self.play(*[FadeIn(n) for n in nums], *[FadeIn(l) for l in labs], run_time=0.5)
        self.wait(1.3)

        # outro with a small graphic (hidden-question + check)
        gbar = RoundedRectangle(corner_radius=0.12, width=2.6, height=0.7,
                                fill_color=INK, fill_opacity=0.9, stroke_width=0)
        gq = txt("?", fs=40, color="#FDF8F3", weight=BOLD).move_to(gbar)
        gck = txt("✓", fs=46, color=GREEN, weight=BOLD).next_to(gbar, RIGHT, buff=0.35)
        g = VGroup(gbar, gq, gck)
        outro(self, "Answering without the question\nisn't always a flaw.", g, fs=42)


# =============================================================================
# 3.  Filler-gap: dependency arc, DAS probe, emergence with data
# =============================================================================
class FillerGap(Scene):
    def construct(self):
        self.wait(0.3)

        # ---- Beat A: the filler -> gap dependency (arc ABOVE the text) --
        s = "Who did the teacher like ___ ?"
        sent = txt(s, fs=44, weight=BOLD, t2c={"Who": BLUE, "___": INK3})
        fit(sent, w=7.2).move_to(UP * 0.2)
        self.play(Write(sent), run_time=1.0)

        filler = part(sent, s, "Who")
        gap = part(sent, s, "___")
        arc = CurvedArrow(filler.get_top() + UP * 0.28, gap.get_top() + UP * 0.28,
                          angle=-TAU / 5, color=ACCENT, stroke_width=7, tip_length=0.26)
        flab = txt("filler", fs=28, color=BLUE, weight=BOLD).next_to(filler, DOWN, buff=0.3)
        glab = txt("gap", fs=28, color=INK3, weight=BOLD).next_to(gap, DOWN, buff=0.3)
        self.play(Create(arc), run_time=0.8)
        self.play(FadeIn(flab), FadeIn(glab), run_time=0.4)
        self.wait(0.7)

        # same dependency, rarer construction (topicalization)
        s2 = "The author, the teacher liked ___ ."
        sent2 = txt(s2, fs=44, weight=BOLD, t2c={"The author": GOLD, "___": INK3})
        fit(sent2, w=7.4).move_to(UP * 0.2)
        f2 = part(sent2, s2, "Theauthor")
        g2 = part(sent2, s2, "___")
        arc2 = CurvedArrow(f2.get_top() + UP * 0.28, g2.get_top() + UP * 0.28,
                           angle=-TAU / 5, color=ACCENT, stroke_width=7, tip_length=0.26)
        same = txt("same dependency", fs=32, color=INK2, weight=BOLD).move_to(DOWN * 1.9)
        self.play(FadeOut(flab), FadeOut(glab), run_time=0.3)
        self.play(FadeOut(sent), FadeOut(arc), FadeIn(sent2), FadeIn(arc2), run_time=0.7)
        self.play(FadeIn(same), run_time=0.5)
        self.wait(0.9)

        # ---- Beat B: DAS causal probe flips the prediction --------------
        self.play(*[FadeOut(m) for m in self.mobjects], run_time=0.5)
        ttl = txt("a causal probe (DAS)", fs=32, color=INK, weight=BOLD).move_to(UP * 3.2)
        neurons = VGroup(*[Circle(radius=0.46, stroke_color=INK2, stroke_width=4,
                                  fill_color=WHT, fill_opacity=1) for _ in range(7)])
        neurons.arrange(RIGHT, buff=0.36).move_to(UP * 1.4)
        self.play(FadeIn(ttl), LaggedStart(*[GrowFromCenter(n) for n in neurons],
                                           lag_ratio=0.08), run_time=0.9)

        inj = chip("filler = 1", GREEN, fs=34).move_to(DOWN * 0.6)
        vec = Arrow(inj.get_top(), neurons[3].get_bottom(), buff=0.12, color=GREEN,
                    stroke_width=8, max_tip_length_to_length_ratio=0.25)
        self.play(FadeIn(inj, shift=UP * 0.2), GrowArrow(vec), run_time=0.7)
        self.play(neurons[3].animate.set_fill(GREEN, 1).set_stroke(GREEN, 5),
                  Flash(neurons[3], color=GREEN, flash_radius=0.85), run_time=0.7)

        ps = "him  →  ___ ?"
        pred = txt(ps, fs=46, weight=BOLD, t2c={"him": INK3, "___ ?": ACCENTD})
        pred.move_to(DOWN * 2.7)
        him = part(pred, ps, "him")
        strike = Line(him.get_left() + LEFT * 0.05, him.get_right() + RIGHT * 0.05,
                      color=ACCENTD, stroke_width=5)
        self.play(FadeIn(pred), run_time=0.5)
        self.play(Create(strike), run_time=0.5)
        self.wait(1.0)

        # ---- Beat C: emerges with training data (real Fig. 3 shape) -----
        self.play(*[FadeOut(m) for m in self.mobjects], run_time=0.5)
        ch = txt("emerges with training data", fs=32, weight=BOLD).move_to(UP * 3.25)

        o = LEFT * 3.0 + DOWN * 2.9
        xax = Arrow(o, o + RIGHT * 6.3, buff=0, stroke_width=5, color=INK2,
                    max_tip_length_to_length_ratio=0.025)
        yax = Arrow(o, o + UP * 5.6, buff=0, stroke_width=5, color=INK2,
                    max_tip_length_to_length_ratio=0.03)
        ylab = txt("causal strength", fs=26, color=INK2, weight=BOLD).rotate(PI / 2)
        ylab.next_to(yax, LEFT, buff=0.18)
        xticks = VGroup(
            txt("1M", fs=24, color=INK3, weight=BOLD).move_to(o + RIGHT * 0.5 + DOWN * 0.4),
            txt("10M", fs=24, color=INK3, weight=BOLD).move_to(o + RIGHT * 3.1 + DOWN * 0.4),
            txt("100M", fs=24, color=INK3, weight=BOLD).move_to(o + RIGHT * 5.9 + DOWN * 0.4),
        )
        xlab = txt("training tokens", fs=26, color=INK2, weight=BOLD).next_to(xax, DOWN, buff=0.55)
        self.play(FadeIn(ch), GrowArrow(xax), GrowArrow(yax), FadeIn(ylab),
                  FadeIn(xticks), FadeIn(xlab), run_time=0.8)

        specs = [(PLUM, 4.9), (GREEN, 4.3), (GOLD, 3.4), (BLUE, 2.9)]
        xs = np.linspace(0, 6.0, 40)
        curves = []
        for col, top in specs:
            ys = top * (xs / 6.0) ** 1.5 + 0.15
            pts = [o + RIGHT * x + UP * y for x, y in zip(xs, ys)]
            cm = VMobject(stroke_color=col, stroke_width=7).set_points_smoothly(pts)
            curves.append(cm)
        self.play(*[Create(c) for c in curves], run_time=1.7, rate_func=linear)
        dots = VGroup(*[Dot(c.get_end(), color=c.get_stroke_color(), radius=0.11)
                        for c in curves])
        self.play(FadeIn(dots), run_time=0.3)
        self.wait(1.0)

        # outro graphic: small rising arrow-curve
        og = LEFT * 1.3 + DOWN * 0.6
        gcurve = VMobject(stroke_color=ACCENT, stroke_width=8).set_points_smoothly(
            [og + RIGHT * x + UP * (1.4 * (x / 2.6) ** 1.6) for x in np.linspace(0, 2.6, 20)])
        gtip = Arrow(gcurve.points[-3], gcurve.get_end() + RIGHT * 0.05 + UP * 0.05,
                     buff=0, color=ACCENT, stroke_width=8, max_tip_length_to_length_ratio=1.2)
        g = VGroup(gcurve, gtip)
        outro(self, "It emerges, but needs far more\ndata than children do.", g, fs=42)
