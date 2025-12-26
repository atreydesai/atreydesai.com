<script lang="ts">
  import Seo from "$lib/components/Seo.svelte";
  import NotesList from "./NotesList.svelte";
  import notes from "./notes.yaml";
</script>

<Seo title="Preston Fu – Notes" description="Writing" />

<div class="text-lg">
  <div class="layout-md space-y-8">
    <p>
      Writing not directly related to my research. May contain TODOs; please don't
      hesitate to reach out!
    </p>
    <section>
      <h2 class="heading2">Scribing</h2>
      <p class="mb-2">Some of my favorite courses at Berkeley!</p>
      <NotesList data={notes.courses} />
    </section>
    <section>
      <h2 class="heading2">Long ago</h2>
      <p class="mb-2">
        Before undergrad, I considered studying pure math. Here are some
        summaries of what I was reading at the time.
      </p>
      <NotesList data={notes.artifacts} />
    </section>
  </div>
</div>
