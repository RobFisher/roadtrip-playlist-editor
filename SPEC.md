Rob's Road-trip Playlist Editor

# Overview
A playlist editor specifically designed for a road trip I am going on with friends
to the Belgian Grand Prix. But really it's just an editor with some particular UI
ideas I have in mind, but I want to make it multi-user because of the trip.

It's a web based editor that can be hosted on AWS infrastructure.

The unique UI concept is that there should be a many to many relationship
between songs and playlists and it should be easy to add a song to multiple playlists,
see which playlists a song is on and move it between them or copy it to multiple ones.
When viewing playlists, it should be easy to see how many other playlists each song
is in.

We will have the concept of a project, which is just a set of playlists. I should be able
to invite friends to work on a project.

# Most important rule
For sharing information between users we may store at most email addresses: no other PII.
Store everything using data handling best practices.

# Development
Make a flake-based Nix devenv for the CLI parts of the development environment.

The app will be coded in Typescript.

Nix will just install Nodejs: after that just use npm to manage
the dependencies. Avoid installing Node stuff globally; keep it in the devenv.

The UI framework will be React. I am not very familiar with React so make it clear
which parts of the code are interesting and which are React-specific boilerplate and
scaffolding.

Deployment to AWS will be with CDK. The Nix devenv will make relevant AWS and CDK
CLI tools available.

Prefer to use existing libraries where appropriate: keep new code minimal.

# Design
The app should load completely into the browser as a single page. Use DynamoDb for
back-end storage: the main reason for this is sharing of playlists between users.

To begin with we should support import and export of a standard playlist file format.
The intent is that this path should work without needing third-party auth and may
also provide an interoperability bridge to Spotify and other music services.

Spotify integration is still a goal, but file-based import/export should be delivered
first so we can avoid being blocked by third-party auth issues.

We may support other music services in future.

## UI
This is primarily a desktop-focused web app. The main UI concept is scrolling vertical
panes with songs in rectangles that can be dragged around. At least 3 panes should fit
side by side on a 1080P display.

Each song rectangle should show the title and artist, the number of playlists the song
is in, and a small thumbnail of the art for the song.

The left pane is special: this is the search pane. We will start by being able to search
Spotify, but we should also support a low-friction search option that does not require
individual user auth where possible (for example a free/public song metadata provider).
I would also like to be able to get lists of songs in other ways, such as by asking an
LLM for suggestions.

Other panes show playlists. It should be possible to choose which playlists appear in
which panes.

Songs can be dragged between playlists. The default is to copy them with a left drag.
Right dragging should move a song by removing it from the source location (unless the
source location is the search pane) and adding it to the destination location.

Right-clicking a song should open a context menu. Options should include listing
the playlists a song is in: it should be easy to open these playlists in more panes
or add and remove songs from them with a check-box.

# Open questions
Sign-ins may be needed for the following reasons:
 - to sign-in with Spotify to import and export playlists
 - to identify users to make projects sharable
 - to access song search features of Spotify
 - to access LLM features

I would like to minimise the number of sign-ins required: if it is possible to use
a single Google SSO for everything we should. If we can access features without
sign-in, let's try that.

We should prioritize features in this order if auth gets difficult:
 - file-based playlist import/export
 - free/public song search integration where available
 - Spotify auth-based import/export

I am not sure how best to handle concurrent editing. Ideally if another user makes
a change to a playlist I am editing, this should be visible to me straight away.
If there are delays, inconsistencies should be handled gracefully and as non-destructively
as possible.
