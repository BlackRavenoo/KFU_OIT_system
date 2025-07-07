<script lang="ts">
    import Nav from '$lib/Nav.svelte'
</script>

<!-- File: www/src/App.svelte -->
<!-- Home page structure:
 --  Header
 ---- Navigation
 ---- Banner
 --  Main
 --  Footer
 ---- Links
 ---- Information
 ---- Contacts
 -->

<div class="container">
    <header>
        <Nav />
    </header>
    <main>
        <h1>KFU OIT System</h1>
        <p>Lorem Ipsum Dolor Sit Dolores. Lorem Ipsum Dolor Sit Dolores. Lorem Ipsum Dolor Sit Dolores.</p>
    </main>
</div>

<style>
    .container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        width: 100vw;
        min-height: 100vh;
        margin: 0 auto;
    }

    main {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 0 20px;
        color: var(--blue);
    }

    header {
        width: 100%;
        background-color: var(--light-blue);
        padding: var(--padding-top) 0;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
</style>
