import subprocess, os

video = r'd:\workspace-job\ai-video-editor\test.mp4'
out   = r'd:\workspace-job\ai-video-editor\test_out.mp4'
font  = r'd:\workspace-job\ai-video-editor\src\font\Pyidaungsu.ttf'
txt   = r'd:\workspace-job\ai-video-editor\test_text.txt'

with open(txt, 'w', encoding='utf-8') as f:
    f.write('Myanmar text test')

def esc(p):
    return p.replace('\\', '/').replace(':', '\\:')

fc = (
    "[0:v]scale=1080:1920:flags=lanczos,boxblur=20:20[bg];"
    "[0:v]scale=1080:-2:flags=lanczos,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black[fg];"
    "[bg][fg]overlay=0:0[comp];"
    f"[comp]drawtext=textfile='{esc(txt)}':fontfile='{esc(font)}':x=100:y=900:fontsize=60:fontcolor=0xffffff[vout]"
)

cmd = [
    'ffmpeg', '-y', '-nostdin',
    '-i', video,
    '-filter_complex', fc,
    '-map', '[vout]',
    '-map', '0:a?',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',
    '-movflags', '+faststart',
    out,
]

print('RUNNING FFmpeg with drawtext + textfile...')
proc = subprocess.run(cmd, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
print('RETURN CODE:', proc.returncode)
stderr = proc.stderr.decode('utf-8', errors='replace')
print('STDERR (last 3000 chars):')
print(stderr[-3000:])
if os.path.exists(out):
    print('OUTPUT FILE SIZE:', os.path.getsize(out), 'bytes')
else:
    print('OUTPUT FILE NOT CREATED')
