---
title: "Vibe coding"
description: "A reflection on vibe coding and its impact"
date: "Apr 02 2025"
draft: false
---

It is somewhat of a rite of passage for a programmer to create a game. This journey can be both exhilarating and challenging, as it involves mastering various aspects of game development, from design and art to programming and testing.

My own adventure began a few years before I started my career as a software engineer. I was inspired by the arcade games I played as a child and wanted to create something that would bring me joy and challenge me to learn new skills.

At the time, I was learning JavaScript, and I thought it would be fun to build a simple arcade game. I started by considering the core game mechanics and selecting an artistic style, then began coding in earnest.

I only got so far before realizing that I needed more time than I had to finish the project. I decided to take a break and return to it later. I never did.

Fast forward to today, and [“vibe coding”](https://x.com/karpathy/status/1886192184808149383) is a term you hear quite often. It describes a way to build software without actually touching code. While that might be the general concept, it’s not always the best approach, nor is it fully feasible yet. A feedback loop that requires human intervention still exists.

One evening, I was browsing social media and noticed a post about a game competition with a rule requiring that most of the code be written by AI. I decided to dust off my abandoned game and finally complete it.

As you might imagine, the code was in poor shape after being idle for the larger part of two decades. My first steps were to clean it up and bring everything up to date.

To do this, I opened VS Code, pointed Copilot at the existing source files, and asked it to do the job. Although the technology isn’t exactly new anymore, it’s still impressive to watch it work, especially on a small project where it can “focus.” It handled everything quickly, and soon I had a working prototype. At this point, the project consisted of an HTML file, a CSS file, and a TypeScript file.

I then spent more time improving the game, prompt by prompt. Most refinements came through Claude 3.5 or 3.7, and sometimes Anthropic’s reasoning model or O3 from OpenAI. I might have taken pieces out for discussion with Grok 3 from xAI. I primarily switched among these models to explore their limits, and sometimes because I wasn’t getting the output I wanted.

All of these models performed well, especially on smaller tasks. Then Gemini 2.5 Pro Experimental was released about a week ago.

Initially, I used the AI Studio interface with the new model and was amazed by [how much](https://x.com/claudiuivan/status/1905065239462478266) it could handle with a single, relatively simple prompt. By that stage, the project accumulated about 1,500–2,000 lines of code (around 20,000 tokens), and I began noticing some degradation of the outputs of the other models.

I quickly realized that I didn’t want to keep moving code through a chat interface. At the time, none of the editors I used supported this new model, so I looked around and discovered Aider, which had just added support. It was the perfect opportunity to try a tool I was unfamiliar with.

[Aider](https://aider.chat/) is a command-line tool similar in capabilities to Copilot Edits or Cursor Composer. Although it has a learning curve, I found it intuitive and powerful. One especially interesting aspect of the project is that it “dogfoods” itself and [publishes stats](https://aider.chat/docs/faq.html#what-llms-do-you-use-to-build-aider) on the language models used for its own development.

Once I was comfortable with Aider, I could quickly add new features and fix problems because Gemini 2.5 handled most of what I threw at it. If I recall correctly, there were only three instances where it returned code that didn’t compile. Fortunately, the tool lets you feed terminal output back into the LLM so it can understand the error and correct it.

Although I still did some technical work, my focus shifted further toward the game’s design. My development cycle was to reason about the game, prompt the LLM for an implementation, and then test it. Even though I’m an engineer, I found I could rely more on creativity and intuition than on my coding skills.

I’m unsure whether someone without technical knowledge would find this process equally straightforward, but there’s undoubtedly a growing market for tools that abstract away the technical details of programming. Since I’m not in the target audience for such tools, I won’t expand on them.

On the other hand, I am sure that “vibe coding”  is not a replacement for deliberate programming. While it certainly accelerates rapid prototyping and helps with experimentation, it often lacks the precision and thorough control you gain by actively writing and refining your the code. In a real production environment, the ability to master the technology, troubleshoot, and optimize code is irreplaceable.

One significant success of this project was realizing that now, with minimal time investment and a small enough scope, I can build projects I’ve been putting off due to lack of time.

In fewer than 100 prompts, some debugging, and about 20 hours of total work spread over a couple of weeks, I managed to finalize a project I had been neglecting for years.

The result of this journey is called Orbit, and can be played at this [link](https://orbit.claudiu-ivan.com).
