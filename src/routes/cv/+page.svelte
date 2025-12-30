<script lang="ts">
    import Seo from "$lib/components/Seo.svelte";
    import { Download } from "@jis3r/icons";
</script>

<Seo
    title="CV | Atrey Desai"
    description="Curriculum Vitae of Atrey Desai - comprehensive academic and professional history."
/>

<div class="layout-main py-8 md:py-12">
    <div class="flex items-center justify-between mb-8">
        <h1 class="heading-display text-3xl text-ink-900 dark:text-cream-100">
            curriculum vitae
        </h1>

        <a
            href="/cv.pdf"
            download="Atrey_Desai_CV.pdf"
            class="btn-primary inline-flex items-center gap-2"
        >
            <Download size={16} />
            Download PDF
        </a>
    </div>

    <p class="text-ink-600 dark:text-cream-400 mb-8">
        A comprehensive overview of my academic and professional history. For a
        condensed version, see my <a href="/resume" class="link">resume</a>.
    </p>

    <!-- PDF Embed -->
    <div
        class="w-full rounded-lg overflow-hidden shadow-lg border border-cream-200 dark:border-ink-700"
    >
        <iframe
            src="/cv.pdf"
            class="w-full h-[80vh] min-h-[600px]"
            title="Atrey Desai CV"
        ></iframe>
    </div>

    <!-- CV Content Sections -->
    <div class="mt-12 space-y-10 text-serif">
        <!-- Education -->
        <section>
            <h2 class="section-heading">education</h2>
            <div class="text-ink-700 dark:text-cream-300">
                <p class="font-medium text-ink-900 dark:text-cream-100">
                    University of Maryland, College Park
                </p>
                <p>
                    B.S. in Computer Science (Honors) & B.A. in Linguistics
                    (Minor in Korean Studies) · Expected May 2027
                </p>
                <p class="text-sm text-ink-500 dark:text-ink-400 mt-1">
                    Advisors: <a
                        href="https://www.cs.umd.edu/people/rudinger"
                        class="link">Prof. Rachel Rudinger</a
                    >
                    &
                    <a href="https://www.cs.umd.edu/~jbg/" class="link"
                        >Prof. Jordan Boyd-Graber</a
                    >
                </p>
                <p class="text-sm text-ink-500 dark:text-ink-400 mt-1">
                    <strong>Coursework:</strong> Natural Language Processing (Grad),
                    Commonsense Reasoning (Grad), Machine Learning, Data Science,
                    Parallel Computing*, Computer Systems, Syntax, Phonetics, Psycholinguistics.
                </p>
            </div>
        </section>

        <!-- Experience -->
        <section>
            <h2 class="section-heading">experience</h2>
            <div class="space-y-6 text-ink-700 dark:text-cream-300">
                <!-- Learn Prompting -->
                <div>
                    <div
                        class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1"
                    >
                        <p class="font-medium text-ink-900 dark:text-cream-100">
                            Learn Prompting
                        </p>
                        <p class="text-sm text-ink-500 dark:text-ink-400">
                            May 2025 – present
                        </p>
                    </div>
                    <p class="italic">
                        Member of Technical Staff (San Francisco, CA)
                    </p>
                    <ul class="list-disc list-inside text-sm mt-2 space-y-1">
                        <li>
                            Researching robustness of AI safety judges against
                            CBRNE-related adversarial content.
                        </li>
                        <li>
                            Running Hackaprompt, the world's largest red-teaming
                            hackathon, overseeing user engagement and technical
                            challenges.
                        </li>
                    </ul>
                </div>

                <!-- UMD CLIP Lab -->
                <div>
                    <div
                        class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1"
                    >
                        <p class="font-medium text-ink-900 dark:text-cream-100">
                            University of Maryland, College Park
                        </p>
                        <p class="text-sm text-ink-500 dark:text-ink-400">
                            May 2024 – present
                        </p>
                    </div>
                    <p class="italic">Undergrad Researcher, CLIP Lab</p>
                    <p class="text-sm text-ink-500 dark:text-ink-400">
                        Advisors: Prof. Rachel Rudinger & Prof. Jordan
                        Boyd-Graber
                    </p>
                    <ul class="list-disc list-inside text-sm mt-2 space-y-1">
                        <li>
                            Validated robustness of LLM-generated MCQs for
                            unintended artifacts to assess if questions are
                            solvable without full context, providing a framework
                            that improves the reliability of synthetic data for
                            benchmark evaluation.
                        </li>
                        <li>
                            Architected an adversarial benchmark to test VLM
                            capabilities in detecting out-of-context (OOC)
                            video-based misinformation on social media based on
                            multimodal clues and user interactions.
                        </li>
                    </ul>
                </div>

                <!-- UT Arlington -->
                <div>
                    <div
                        class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1"
                    >
                        <p class="font-medium text-ink-900 dark:text-cream-100">
                            The University of Texas at Arlington
                        </p>
                        <p class="text-sm text-ink-500 dark:text-ink-400">
                            Feb 2024 – present
                        </p>
                    </div>
                    <p class="italic">Visiting Researcher, ACL2 Lab & NSF</p>
                    <p class="text-sm text-ink-500 dark:text-ink-400">
                        Advisor: Prof. Kenny Zhu
                    </p>
                    <ul class="list-disc list-inside text-sm mt-2 space-y-1">
                        <li>
                            Designed AniVoice-cat, a dataset of 26,000+
                            annotated cat vocalizations from 250+ hours of video
                            and identified 57 unique cat phones, establishing a
                            foundational resource for computational research in
                            non-human communication.
                        </li>
                        <li>
                            Improved transcription pipeline using PANNs and
                            HuBERT models to 96% accuracy with 93% top-5
                            accuracy in action recognition, setting a new
                            state-of-the-art for automated animal vocalization
                            analysis.
                        </li>
                    </ul>
                </div>

                <!-- UMD FIRE -->
                <div>
                    <div
                        class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1"
                    >
                        <p class="font-medium text-ink-900 dark:text-cream-100">
                            University of Maryland, College Park
                        </p>
                        <p class="text-sm text-ink-500 dark:text-ink-400">
                            Dec 2023 – Aug 2024
                        </p>
                    </div>
                    <p class="italic">
                        Researcher, FIRE Sustainability Analytics Lab
                    </p>
                    <p class="text-sm text-ink-500 dark:text-ink-400">
                        Advisor: Prof. Thanicha Ruangmas
                    </p>
                    <ul class="list-disc list-inside text-sm mt-2 space-y-1">
                        <li>
                            Developed Python pipeline for environmental impact
                            assessments of U.S. emissions, enabling more
                            efficient policy.
                        </li>
                        <li>
                            Drafted a framework to guide evidence-based
                            policymaking on climate restoration strategies.
                        </li>
                    </ul>
                </div>

                <!-- Brown -->
                <div>
                    <div
                        class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1"
                    >
                        <p class="font-medium text-ink-900 dark:text-cream-100">
                            Brown University
                        </p>
                        <p class="text-sm text-ink-500 dark:text-ink-400">
                            Dec 2020 – June 2023
                        </p>
                    </div>
                    <p class="italic">
                        Researcher, Reinforcement Learning at Brown Group
                    </p>
                    <p class="text-sm text-ink-500 dark:text-ink-400">
                        Advisor: Prof. Michael Littman
                    </p>
                    <ul class="list-disc list-inside text-sm mt-2 space-y-1">
                        <li>
                            Developed a custom RL environment that empowered
                            non-technical users to programmatically solve
                            complex tasks by defining reward functions and
                            specifying agent behavior, reducing task setup time.
                        </li>
                        <li>
                            Published and presented research at two top-tier
                            workshops (AAAI, RLDM), demonstrating how
                            human-readable interfaces enable fine-grained
                            control during inference and improve AI-human
                            interaction in robotics.
                        </li>
                    </ul>
                </div>
            </div>
        </section>

        <!-- Publications -->
        <section>
            <h2 class="section-heading">publications</h2>
            <div class="space-y-6 text-ink-700 dark:text-cream-300">
                <!-- Preprints -->
                <div>
                    <h3
                        class="font-medium text-ink-900 dark:text-cream-100 mb-3"
                    >
                        Preprints <span class="text-sm font-normal text-ink-500"
                            >* — equal contribution</span
                        >
                    </h3>
                    <ol class="list-decimal list-inside space-y-3 text-sm">
                        <li>
                            <strong
                                >BenchMarker: An Education-Inspired Toolkit for
                                Highlighting Flaws in Multiple-Choice Benchmarks</strong
                            >.<br />Nishant Balepur, Bhavya Rajasekaran, Jane
                            Oh, Michael Xie,
                            <span class="text-ink-900 dark:text-cream-100"
                                >Atrey Desai</span
                            >, …, Jordan Boyd-Graber.<br /><em
                                >(Under Review at ACL)</em
                            >.
                        </li>
                        <li>
                            <strong
                                >Emergence of Filler–Gap Mechanisms in
                                Developmentally Constrained Language Models</strong
                            >.<br /><span
                                class="text-ink-900 dark:text-cream-100"
                                >Atrey Desai</span
                            >
                            and Sathvik Nair.<br /><em
                                >(Under Review at TLS, ACL)</em
                            >.
                        </li>
                        <li>
                            <a
                                href="https://arxiv.org/abs/2510.07761"
                                class="link"
                                ><strong
                                    >Test-Time Reasoners Are Strategic
                                    Multiple-Choice Test-Takers</strong
                                ></a
                            >.<br />Nishant Balepur,
                            <span class="text-ink-900 dark:text-cream-100"
                                >Atrey Desai</span
                            >
                            and Rachel Rudinger.<br /><em
                                >arXiv:2510.07761 (Under Review at ACL Rolling
                                Review)</em
                            >.
                        </li>
                        <li>
                            <strong
                                >A Preview of Computational Animal Linguistics</strong
                            >.<br /><span
                                class="text-ink-900 dark:text-cream-100"
                                >Atrey Desai</span
                            >, Tirza Panunto, Lindsay Pike, Theron S. Wang, Tuan
                            M. Dang, Hridayesh Lekhak and Kenny Q. Zhu.<br /><em
                                >(Under Review at Computational Linguistics)</em
                            >.
                        </li>
                    </ol>
                </div>

                <!-- Conference Publications -->
                <div>
                    <h3
                        class="font-medium text-ink-900 dark:text-cream-100 mb-3"
                    >
                        Conference Publications
                    </h3>
                    <ol class="list-decimal list-inside space-y-3 text-sm">
                        <li>
                            <a
                                href="https://scholar.google.com/citations?view_op=view_citation&hl=en&user=hTDzj6cAAAAJ&citation_for_view=hTDzj6cAAAAJ:d1gkVwhDpl0C"
                                class="link"
                                ><strong
                                    >Language Models Generate Multiple-Choice
                                    Questions with Artifacts</strong
                                ></a
                            >.<br /><span
                                class="text-ink-900 dark:text-cream-100"
                                >Atrey Desai</span
                            >, Nishant Balepur and Rachel Rudinger.<br /><em
                                >Mid-Atlantic Student Colloquium on Speech,
                                Language and Learning (<strong>MASC-SLL</strong
                                >), 2025</em
                            >.
                        </li>
                        <li>
                            <a
                                href="https://scholar.google.com/citations?view_op=view_citation&hl=en&user=hTDzj6cAAAAJ&citation_for_view=hTDzj6cAAAAJ:u5HHmVD_uO8C"
                                class="link"
                                ><strong
                                    >Reinforcement Learning As End-User
                                    Trigger-Action Programming</strong
                                ></a
                            >.<br />Chace Hayhurst, Hyojae Park,
                            <span class="text-ink-900 dark:text-cream-100"
                                >Atrey Desai</span
                            >, Suheidy De Los Santos and Michael Littman.<br
                            /><em
                                >AAAI Conference on Artificial Intelligence (<strong
                                    >AAAI</strong
                                >) IML Workshop, 2022</em
                            >.<br /><em
                                >Reinforcement Learning and Decision Making (<strong
                                    >RLDM</strong
                                >), 2022</em
                            >.
                        </li>
                    </ol>
                </div>
            </div>
            <p class="text-ink-600 dark:text-cream-400 mt-4">
                See the full list on my <a href="/research" class="link"
                    >research page</a
                >.
            </p>
        </section>

        <!-- Honors & Awards -->
        <section>
            <h2 class="section-heading">honors & awards</h2>
            <div class="space-y-2 text-ink-700 dark:text-cream-300">
                <div class="flex flex-col sm:flex-row sm:justify-between">
                    <span><strong>SPIRE Research Grant</strong> ($3,000)</span>
                    <span class="text-ink-500 dark:text-ink-400">2025</span>
                </div>
                <div class="flex flex-col sm:flex-row sm:justify-between">
                    <span
                        ><strong>Omicron Delta Kappa Top 10 Freshman</strong
                        ></span
                    >
                    <span class="text-ink-500 dark:text-ink-400">2024</span>
                </div>
                <div class="flex flex-col sm:flex-row sm:justify-between">
                    <span><strong>CMSC & ARHU Dean's List</strong></span>
                    <span class="text-ink-500 dark:text-ink-400"
                        >2023 – 2025</span
                    >
                </div>
                <div class="flex flex-col sm:flex-row sm:justify-between">
                    <span
                        ><strong>UMD President's Scholarship</strong> ($50,000)</span
                    >
                    <span class="text-ink-500 dark:text-ink-400">2023</span>
                </div>
                <div class="flex flex-col sm:flex-row sm:justify-between">
                    <span
                        ><strong>NMSC National Merit Scholarship</strong> ($4,000)</span
                    >
                    <span class="text-ink-500 dark:text-ink-400">2023</span>
                </div>
                <div class="flex flex-col sm:flex-row sm:justify-between">
                    <span
                        ><strong>Catherine Yang Scholarship</strong> ($1,000)</span
                    >
                    <span class="text-ink-500 dark:text-ink-400">2023</span>
                </div>
            </div>
        </section>

        <!-- Talks -->
        <section>
            <h2 class="section-heading">talks</h2>
            <div class="space-y-4 text-ink-700 dark:text-cream-300">
                <div>
                    <p class="font-medium text-ink-900 dark:text-cream-100">
                        Adaptor Grammars and Neural Networks for Feline Lexical
                        Discovery
                    </p>
                    <ul class="list-disc list-inside text-sm mt-2 space-y-1">
                        <li>
                            The University of Texas at Arlington <span
                                class="text-ink-500 dark:text-ink-400"
                                >— July 2024</span
                            >
                        </li>
                        <li>
                            University of Maryland, College Park <span
                                class="italic">(adapted)</span
                            >
                            <span class="text-ink-500 dark:text-ink-400"
                                >— Nov 2024</span
                            >
                        </li>
                    </ul>
                </div>
            </div>
        </section>

        <!-- Professional Responsibilities -->
        <section>
            <h2 class="section-heading">professional responsibilities</h2>
            <div class="space-y-4 text-ink-700 dark:text-cream-300">
                <div class="flex flex-col sm:flex-row sm:justify-between">
                    <span
                        ><strong>Subreviewer</strong>, ACL Rolling Review (ARR)</span
                    >
                    <span class="text-ink-500 dark:text-ink-400">2025</span>
                </div>
                <div class="flex flex-col sm:flex-row sm:justify-between">
                    <span
                        ><strong>Member</strong>, University Research Advisory
                        Board</span
                    >
                    <span class="text-ink-500 dark:text-ink-400"
                        >2025 – present</span
                    >
                </div>
                <div>
                    <div class="flex flex-col sm:flex-row sm:justify-between">
                        <span
                            ><strong>Vice Chair</strong>, Computer Science
                            Department Council</span
                        >
                        <span class="text-ink-500 dark:text-ink-400"
                            >2025 – present</span
                        >
                    </div>
                    <p
                        class="text-sm text-ink-500 dark:text-ink-400 italic ml-4"
                    >
                        Appointed by faculty and student body to serve as vice
                        chair; represent 4,200+ CS undergraduates.
                    </p>
                </div>
                <div>
                    <div class="flex flex-col sm:flex-row sm:justify-between">
                        <span
                            ><strong>Senior Member</strong>, FIRE Student
                            Leadership Council</span
                        >
                        <span class="text-ink-500 dark:text-ink-400"
                            >2024 – present</span
                        >
                    </div>
                    <p
                        class="text-sm text-ink-500 dark:text-ink-400 italic ml-4"
                    >
                        Represented 1000+ peers, ran events & workshops, and
                        reformed class curricula.
                    </p>
                </div>
                <div>
                    <div class="flex flex-col sm:flex-row sm:justify-between">
                        <span><strong>University Ambassador</strong></span>
                        <span class="text-ink-500 dark:text-ink-400"
                            >2024 – present</span
                        >
                    </div>
                    <p
                        class="text-sm text-ink-500 dark:text-ink-400 italic ml-4"
                    >
                        Represented the CS Dept. & CMNS College at admissions
                        events and to official guests.
                    </p>
                </div>
                <div>
                    <p class="font-medium text-ink-900 dark:text-cream-100">
                        Mentorship
                    </p>
                    <ul class="list-disc list-inside text-sm mt-2 space-y-1">
                        <li>
                            <strong>Office of Undergraduate Research:</strong>
                            Juan Cortés, Kemisola Benson, Vivian Akpala
                            <span class="text-ink-500 dark:text-ink-400"
                                >— 2025</span
                            >
                        </li>
                        <li>
                            <strong>Technica Mentoring:</strong> Savya Miriyala,
                            Tanya Grover, Jessica Ononye, Nakshatra Hiray
                            <span class="text-ink-500 dark:text-ink-400"
                                >— 2024</span
                            >
                        </li>
                        <li>
                            <strong>Technica Hackathon:</strong> Volunteer and
                            mentor
                            <span class="text-ink-500 dark:text-ink-400"
                                >— Oct 2024</span
                            >
                        </li>
                        <li>
                            <strong>MSET Robotics Workshops:</strong> Organizer
                            and curriculum designer
                            <span class="text-ink-500 dark:text-ink-400"
                                >— 2020 – 2022</span
                            >
                        </li>
                    </ul>
                </div>
            </div>
        </section>

        <!-- Skills -->
        <section>
            <h2 class="section-heading">skills</h2>
            <div class="space-y-2 text-ink-700 dark:text-cream-300 text-sm">
                <p>
                    <strong>Languages:</strong> Python, Java, JavaScript/HTML/CSS,
                    R, MATLAB.
                </p>
                <p>
                    <strong>Libraries/Frameworks:</strong> Huggingface (Datasets,
                    Transformers), NLTK, PyTorch, Selenium, BeautifulSoup.
                </p>
                <p>
                    <strong>Tools:</strong> Git, Docker, GCP, Google Vertex AI, VS
                    Code.
                </p>
                <p>
                    <strong>Natural Languages:</strong> English (Native), Gujarati
                    (Native), Spanish (Intermediate), Korean (Beginner).
                </p>
            </div>
        </section>
    </div>
</div>
