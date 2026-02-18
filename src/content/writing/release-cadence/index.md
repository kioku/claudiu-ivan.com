---
title: "Release Cadence and the Slowest Feature Trap"
description: "Why milestone-based releases silently kill delivery velocity, and how decoupling internal development cadence from client acceptance timelines fixes it."
date: "2026-02-18"
---

Last year I sat in a call where a project manager said, with complete sincerity, "the release is basically ready, we're just waiting on the document management module." That module had been "almost done" for two months. Behind it sat a dozen tickets. Bug fixes, small improvements, a search performance patch that users had been asking about since September. All tested, approved, and going nowhere.

The part worth paying attention to is that nobody in that call thought this was strange.

There are two ways to run releases. You probably know this already, but the distinction matters more than people give it credit for. The first is milestone-based: you scope a release, assign every ticket to it, and ship when the last ticket is done. The second is time-based: you pick a cadence (say, three weeks), and whatever is ready at the cutoff ships. Whatever isn't ready waits for the next cycle.

Most teams will tell you they run the second way. Almost all of them actually run the first way. The gap between those two things is where releases go to die, and it's worth understanding why the gap exists.

Milestone-based releases are genuinely useful if you're an enterprise client. You can scope what's coming, schedule your UAT around it, get change board approval with a concrete list of what's changing. Change advisory boards, if you haven't had the pleasure, are committees whose entire purpose is to make sure nobody surprises production. They meet on a fixed schedule. They want a fixed scope. "Whatever our vendor happened to finish this month" is not a sentence that goes over well in that room.

So teams accommodate. They scope releases around features. They wait for the big thing to land before cutting the build. This is rational behavior in response to real constraints, which is exactly why it's so persistent and so costly.

The cost is coupling. Your fastest work is now tied to your slowest. That search performance patch? It's done. It's been done for six weeks. Your users will get it whenever the document management module is ready, which is to say, whenever someone finishes wrestling with SharePoint's permission model. You are, in effect, running a convoy where every ship moves at the speed of the slowest vessel, except the slowest vessel keeps discovering new icebergs.

Here's what we changed on that project: we split the two concerns apart entirely. Internal releases run on a fixed three-week cycle. Weeks one and two are development. Week three is freeze and QA. End of week three, the release is cut. If a feature isn't done by freeze, it's not in this release. It catches the next train.

Separately, clients pull releases on their own schedule. The client who needs six weeks of acceptance testing is always a version or two behind the latest cut. That's fine. Actually, it's better than fine, because now they're getting a release that's had three extra weeks of internal use and stabilization before they even start testing it.

The part that surprised me was what people resisted, which isn't the cadence. Everyone agreed three weeks was reasonable. It was the idea that a release could go out without the big feature in it. There's a psychological weight to "the release" that makes people want it to contain something impressive. Shipping twelve small fixes feels like admitting you didn't get the important thing done. Never mind that those twelve fixes are what users actually interact with day to day.

I should be honest about the first cycle under the new system. The client's project sponsor was not thrilled. He'd been expecting the document management module, and instead he got a release that was, from his perspective, a bunch of minor stuff. We had a conversation about it that I would describe as "direct." But by the third cycle, something shifted. The client was receiving more working software per quarter than before. The team had stopped treating release weeks as a crisis. And the document management module shipped on its own timeline, two cycles later, without dragging everything else behind it.

The other lesson from that engagement took longer to learn. The team had actually tried time-based releases once before. It worked for about four months, then quietly reverted to milestone thinking. The reason: one team lead had been the person who enforced the cutoff. She pushed back when someone wanted to delay the freeze "just by a few days." When she moved to another project, the discipline walked out with her.

This is a general problem with process. If it depends on a specific person's willpower, it's not a process. It's a habit that person maintains on behalf of the team. Habits are fragile. What we put in place instead was deliberately mechanical: freeze dates enforced in CI, a written policy that the train leaves on schedule, no exception process. Boring stuff. The kind that survives personnel changes.

There's a blame dynamic here that's worth making explicit. When a milestone-based release slips, someone gets the question: "why isn't this done yet?" It's always the person working on the hardest thing. This is structurally guaranteed. The uncertain task is the one that determines the ship date, so the person on that task is always the one explaining themselves in the standup. Imagine designing a system where the person who took on the most complexity is the one who gets the most pressure. You'd think that was a bad incentive, and you'd be right. Time-based cadence removes this dynamic almost by accident. Features ship when they ship. The release ships on schedule regardless. Nobody's work is blocking anyone else's.

If you're running an enterprise product and your releases keep slipping, look at whether you've accidentally coupled two things that should be separate. Your internal development cadence and your client's acceptance cadence are different processes with different constraints. Let them run on different timelines. Cut releases on a fixed schedule internally. Let clients adopt them at whatever pace their change boards require. The two tracks don not need to be synchronized. They just need to stop pretending to be the same track.
