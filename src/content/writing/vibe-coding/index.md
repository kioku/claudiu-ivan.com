---
title: "Vibe coding an arcade game"
description: ""
date: "Apr 02 2025"
draft: false
---

It is somewhat of a rite of passage for a programmer to create a game. This journey can be both exhilarating and challenging, as it involves mastering various aspects of game development, from design and art to programming and testing.

Mine started a few years before I began my career as a software engineer. I was inspired by the arcade games I played as a child and wanted to create something that would bring me joy and challenge me to learn new skills.

At the time I was learning JavaScript, and I thought it would be a fun project to create a simple arcade game. I started by considering the game mechanics and and settling upon a an artistic style, and then I began coding the game.

I only got so far before I realized that I needed more time than I had to finish the game. I decided to take a break and come back to it later. I never did.

Fast forward to today, and vibe coding is something you hear about somewhat constantly. It's a way to build technical projects without actually touching the code. While this may be true generally speaking, it's not always the best way to approach a project, and not necessarily the exact way in which I approached this project, due to the fact that I did work with the code from time to time.

One evening, I was browsing social media and came across a post about a game competition. I decided to dust off the game I had abandoned, and get it done.

As one would imagine, the game was a pretty bad state, being abandoned for about 15 years or so. The first steps were to clean it up, and bring it up to date.

For this task I spun up vscode, pointed Copilot at the existing source files, and told it to do the job, and it did. It's quite impressive to see this technology in action on very small projects where it's easy to maintain attention. It one shotted the request, and I had a working prototype. At this stage the whole project was an html file, a css file and a typescript file.

I then spent some more time improving the game, prompt by prompt. Most of the using using either Claude 3.5 or 3.7, and maybe sometimes using Anthropic's thinking model or O3 from OpenAI. I might have taken parts out and discussed some of it with Grok 3.

All of these models performed well, especially on smaller tasks. Then Gemini 2.5 Pro Experimental was released, and frankly, blew the competition away for this particular usage case.

While I initially used 2.5 Pro from the AI Studio interface, I quickly realized that I do not want to be moving code around through a chat interface. At the time none of the editors supported the new model, so while looking around I found that Aider had added it. A perfect reason to try out a tool I was not familiar with.

It's a command line tool similar in capabilities to Copilot Edits or Cursor Composer, and while it does have a learning curve, I found it to be quite intuitive and powerful. One pretty amazing thing about the project is that it dogfoods itself, and publishes stats about the process.

Once I got familiarized enough, I was able to blaze through functionality and issues quite fast since Gemini 2.5 seemed to handle most of everything that I threw at it. If I remember correctly, only 3 times did it actually return some code that did not compile. Suffice to say, you can push terminal output as context into Aider, and then ask the LLM to fix the problems.

Although I had to touch the technical parts from time to time, I was able to focus more on the design aspect of the game. The development loop included making some assumptions about how I wanted the game to feel, asking the LLM to implement them, and then testing them out. While I am an engineer by training, I found that I could rely less on my technical skills and more on my creativity and intuition.

That being said, I do not know if someone without technical abilities would have had the same ease as I did. There definitely is a market for tools that can completely abstract away the technical details of programming, allowing non-technical users to create software with ease. Since I am not the target of such tools, I will refrain from discussing them.

One resounding success of this project is the realization that now, with somewhat of a minimal time investment, and given a small enough scope, I can create the projects that I have been postponing due to lack of time.

In less than 100 prompts, some debugging, and about 20 hours of input throughout a couple of weeks, I was able to finalize a project that I have been neglecting.

Orbit can be played at this [link](https://orbit.claudiu-ivan.com).
