https://en.wikipedia.org/wiki/Opus_(audio_format)#/media/File:Opus_quality_comparison_colorblind_compatible.svg

By Jean-Marc Valin - https://opus-codec.org/comparison/, CC BY 3.0, https://commons.wikimedia.org/w/index.php?curid=22463490

In listening tests around 64 kbit/s, Opus shows superior quality compared to HE-AAC codecs, which were previously dominant due to their use of the patented spectral band replication (SBR) technology.[49][6] In listening tests around 96 kbit/s, Opus shows slightly superior quality compared to AAC and significantly better quality compared to Vorbis and MP3.[7][50]

" timestamps are measured in 48 kHz units even if the full bandwidth is not used."
^^ I hope this doesn't effect loop meta tags. Testing needed.
trim feature?

MP3, MP2, AAC, AC3, WAV, WMA, M4A, RM, RAM, OGG, AU, AIF, AIFF, PG, MPEG, MPEG 2, MP4, M4V, MJPG, MJPEG, HD TS, HD MTS, HD M2TS, HD MPG, HD MPEG, HD MP4, HD WMV, QuickTime HD MOV and others
Supported output formats - AAC, AC3, AIFF, AMR, AU, FLAC, M4A, MKA, MP2, MP3, OGG, WAV, WMA

You can use the -ar option to set the sampling rate, and use -sample_fmt to "set the bit depth".

Then you can get the details from the aiff files you created with find *.aiff -exec ffprobe -v error -select_streams a:0 -show_entries stream {} \; to ensure they're of the correct sampling_rate and bit_depth.

https://gamejolt.com/@Fooney 
