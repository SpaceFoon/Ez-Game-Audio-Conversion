Download:

Download ZIP

GitHub


Convert all your audio files to the correct format in just a few clicks.


No more dealing with converting every single new audio file you download!

This command-line application allows you to search for audio files in a specified

directory and its sub-directories and convert them to different output formats.


Right now you need Windows and a terminal to run node. I use VSCode.

This works 100% in my testing so far.

Full GUI is coming soon!


Always back up your stuff first!


## Features:

    Convert from and to any combo of MP3, WAV, Flac, OGG and M4a

    Super simple UI

    Unattended Batch processing, do your whole game folder in once pass.

    File sizes and quality are great.

    Internet not needed!


## Installation

1. Clone or download the repository. (Download ZIP)

2. Install node and dependencies.

3. Not needed with ZIP. Download https://www.ffmpeg.org/download.html

4. Not needed with ZIP. Copy 'ffmpeg.exe' from '\bin' to the root of this project


## Usage

1. node .\app.js\

2. Follow the prompts to provide the necessary information:

3. Watch it go.


## Planned

    I think it uses CBR and I think it should use VBR. It's all VBR now
    Add flac and m4a support for input types  Done
    Add wav and mp3 support to output types. Done
    clean up logs and error handling. Done enough
    fix file names when copying.
    Add midi input support.
    GUI

[SPOILER="Prompt"]

Navigate to the project and then type:

node .\app.js\


Copy and paste (right click) the full file path you wish to search.

Follow the rest of the instructions.



It will now show you the files it found in the search.



You can select for each file or add "a" for all.



After you make your selection/s, it finds duplicate file names with different extensions and drops the lowest quality. The mp3 file will be dropped for the WAV.


Then it builds the final list intended input and output file names and type.




After reviewing, type yes



It may take a moment to do anything but it will log after every file converted.

After it's done you will see a list of failed conversions if any.


[/SPOILER]


If you find any bugs or don't like the way something works let me know.


UPDATE 11/23/23: 

Now supports almost every file type you may need for both input and output.

Midi for input is coming soon but that will be more stuff to install.


I took away bitrate controls for now because they are different for every codec.

I have everything a little lower that 192kbs and I can't hear the difference even when making copies of copies of lossy to lossy formats.

I'll add controls back when the GUI is done but for right now it seems to defeat the purpose of a simple to use software.


UPDATE 12/12/23:

Found and fixed a bug caused by a typo that sometimes caused it to use a lesser format instead of a better one.

GUI is coming along. Turns out its way more work just to make a GUI than it was to make the entire program.

The GUI version is using Tarui with React and will be a stand alone .exe file. This project will remain open source so you can build it yourself if you don't trust me. After that is done I can see about making this work with linux and mac too. Not sure if there would be any use for mobile? Let me know if there is.