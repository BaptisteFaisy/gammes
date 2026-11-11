/**
 * Désynchronisation page ↔ gamme (§ 10, GA-10).
 *
 * Recette 12 : la page source modifiée marque la gamme désynchronisée, avec l'âge de
 * l'écart et le diff proposé.
 */

import { describe, expect, it } from "vitest";
import { human, makeClock, makeDeps, makePage, T0 } from "../helpers";
import { checkSync, isRunnableWhileStale, markSourceGone, stalenessOf } from "../../src/core/binding/binding";
import { proposeRecompile } from "../../src/core/compile/recompile";
import { approveVersion } from "../../src/core/version/versioning";
import { compile, compileAndApprove, deployPage, PAGE_MODIFIEE } from "./fixtures";

const OWNER = "ari:cloud:aaid:demo:ana";

describe("page ↔ gamme (§ 10)", () => {
  it("une page inchangée laisse la gamme synchronisée", async () => {
    const deps = makeDeps();
    const { gamme } = await compileAndApprove(deps);
    const res = await checkSync(deps, gamme.id, deployPage());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.sync).toBe("synced");
    expect(res.value.ageDays).toBeUndefined();
    expect(stalenessOf(res.value.binding, T0)).toBeUndefined();
  });

  it("recette 12 : la page modifiée marque la gamme désynchronisée, avec l'âge et le diff", async () => {
    const clock = makeClock(T0);
    const deps = makeDeps({ clock });
    const { gamme } = await compileAndApprove(deps);
    const modifiee = makePage({ storageBody: PAGE_MODIFIEE });

    const first = await checkSync(deps, gamme.id, modifiee);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.sync).toBe("stale");
    expect(first.value.ageDays).toBe(0);
    expect((await deps.store.gammes.get(gamme.id))?.sync).toBe("stale");

    clock.advanceDays(90);
    const later = await checkSync(deps, gamme.id, modifiee);
    if (!later.ok) throw new Error("checkSync a échoué");
    expect(later.value.ageDays).toBe(90);
    expect(later.value.binding.staleSince).toBe(T0);

    // La désynchronisation ne bloque rien : la gamme approuvée reste déroulable.
    expect(isRunnableWhileStale((await deps.store.gammes.get(gamme.id))!)).toBe(true);
  });

  it("la recompilation proposée produit un diff et un brouillon, sans republier", async () => {
    const deps = makeDeps();
    const { gamme, version } = await compileAndApprove(deps);
    const modifiee = makePage({ storageBody: PAGE_MODIFIEE });
    await checkSync(deps, gamme.id, modifiee);

    const proposed = await proposeRecompile(deps, { gammeId: gamme.id, page: modifiee, confirmedBy: human(OWNER) });
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;
    expect(proposed.value.version.version).toBe(2);
    expect(proposed.value.diff).toContain("v1 → v2");
    expect(proposed.value.diff).toContain("15 minutes");
    expect(proposed.value.gamme.state).toBe("approved"); // la v1 approuvée reste en service
    expect(proposed.value.gamme.currentVersion).toBe(version.version);

    const after = await checkSync(deps, gamme.id, modifiee);
    if (!after.ok) throw new Error("checkSync a échoué");
    expect(after.value.sync).toBe("stale");
    expect(after.value.diff).toContain("v1 → v2"); // le diff est conservé pour la revue
  });

  it("l'approbation de la nouvelle version referme l'écart", async () => {
    const deps = makeDeps();
    const { gamme } = await compileAndApprove(deps);
    const modifiee = makePage({ storageBody: PAGE_MODIFIEE });
    const proposed = await proposeRecompile(deps, { gammeId: gamme.id, page: modifiee, confirmedBy: human(OWNER) });
    if (!proposed.ok) throw new Error("recompilation refusée");

    const approved = await approveVersion(deps, { versionId: proposed.value.version.id, approver: human(OWNER) });
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;
    expect(approved.value.currentVersion).toBe(2);
    const after = await checkSync(deps, gamme.id, modifiee);
    if (!after.ok) throw new Error("checkSync a échoué");
    expect(after.value.sync).toBe("synced");
    expect(after.value.binding.staleSince).toBeUndefined();
    expect((await deps.store.gammes.get(gamme.id))?.sync).toBe("synced");
  });

  it("page disparue : la gamme garde sa dernière version, marquée « source disparue »", async () => {
    const deps = makeDeps();
    const { gamme, version } = await compileAndApprove(deps);
    const res = await checkSync(deps, gamme.id, deployPage({ reachable: false }));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.sync).toBe("source_gone");
    expect((await deps.store.gammes.get(gamme.id))?.sync).toBe("source_gone");
    // Toujours exécutable depuis la base, et l'empreinte d'origine est conservée.
    expect(isRunnableWhileStale((await deps.store.gammes.get(gamme.id))!)).toBe(true);
    expect(res.value.binding.contentHash).toBe(version.contentHash);
    expect(res.value.binding.syncedAt).toBeTruthy();
  });

  it("markSourceGone exige un lien ou une gamme, et un lien manquant est refusé", async () => {
    const deps = makeDeps();
    const gone = await markSourceGone(deps, "gam_inconnu");
    expect(gone.ok).toBe(false);
    if (!gone.ok) expect(gone.error.code).toBe("unknown_gamme");
    const res = await checkSync(deps, "gam_sans_lien", deployPage());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("unknown_gamme");
    expect(await deps.store.bindings.count()).toBe(0);
  });

  it("compiler une page neuve crée son lien, et le conserve à la recompilation", async () => {
    const deps = makeDeps();
    const first = await compile(deps, deployPage());
    expect(await deps.store.bindings.count()).toBe(1);
    const second = await compile(deps, makePage({ storageBody: PAGE_MODIFIEE }));
    expect(second.gamme.id).toBe(first.gamme.id);
    expect(await deps.store.bindings.count()).toBe(1);
  });
});
