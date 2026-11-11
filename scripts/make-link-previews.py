# Makes one 1200x630 link preview picture per client facing link (same look as premium-og.png),
# plus netlify/edge-functions/lib/previews.ts (titles, descriptions, paths) and prints the netlify.toml blocks.
# Run: python3 scripts/make-link-previews.py
import json, os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "artifacts/carousel-generator/public/og")
FONT = "/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf"
PINK, BLACK, GREY = (255, 32, 140), (17, 17, 17), (90, 90, 90)

# id, paths, black lines, pink line, picture sub line, share title, share description
L = [
 ("know-me", ["/know-me", "/know-me/*"], ["GETTING TO KNOW"], "YOU", "A FEW QUESTIONS SO MY POSTS SOUND LIKE YOU", "Getting to know you", "A few quick questions so I can write posts that sound like you."),
 ("treatments-form", ["/treatments-form"], ["WHAT TREATMENTS"], "DO YOU OFFER?", "TICK THEM ALL IN ONE GO", "What treatments do you offer?", "Tick everything you offer in one go so my posts match your clinic."),
 ("fontlab-form", ["/fontlab-form"], ["PICK YOUR"], "HEADLINE FONT", "CHOOSE THE LOOK OF YOUR POSTS", "Pick your headline font", "Choose the font I use for the headlines on your posts."),
 ("approve", ["/approve/*", "/client-approval/*"], ["APPROVE YOUR"], "POSTS", "HAVE A LOOK AND GIVE ME THE NOD", "Approve your posts", "Have a look at your posts and give me the nod before they go out."),
 ("portal", ["/portal/*"], ["YOUR CLIENT"], "PORTAL", "EVERYTHING I MAKE FOR YOU, IN ONE PLACE", "Your client portal", "Everything I make for your clinic, in one place."),
 ("submit", ["/submit/*"], ["SEND ME YOUR"], "BEFORE AND AFTERS", "UPLOAD THEM HERE", "Send me your before and afters", "Upload your before and afters here and I will do the rest."),
 ("clientquestion", ["/clientquestion"], ["I HAVE A"], "QUICK QUESTION", "TAP TO ANSWER IT", "A quick question for you", "I need a quick answer from you so I can carry on with your content."),
 ("onboard", ["/onboard/*"], ["CONNECT YOUR"], "SOCIALS", "SO I CAN POST FOR YOU", "Connect your socials", "Connect your page so I can post for you."),
 ("prizes", ["/prizes"], ["SPIN THE"], "WHEEL", "SEE WHAT YOU HAVE WON", "Spin the wheel", "Give it a spin and see what you have won."),
 ("joingroup", ["/joingroup"], ["JOIN MY"], "FREE GROUP", "FOR AESTHETIC INJECTORS", "Join my free group", "Templates, tips and compliance help for aesthetic injectors."),
 ("99club", ["/99club"], ["THE £99"], "CLUB", "MONTHLY CONTENT FOR CLINICS", "The £99 Club", "Affordable monthly content for your clinic."),
 ("landing", ["/landing"], ["30 DAYS OF"], "CONTENT", "A FREE CALENDAR FOR YOUR CLINIC", "30 days of content for your clinic", "A free 30 day content calendar for your clinic socials."),
 ("dailytasks", ["/dailytasks"], ["YOUR DAILY"], "FIVE", "FIVE SMALL TASKS A DAY FOR YOUR SOCIALS", "Your Daily Five", "Five small tasks a day to keep your clinic socials moving."),
 ("trialbundle", ["/trialbundle"], ["YOUR TRIAL"], "BUNDLE", "TAP TO SEE WHAT IS INSIDE", "Your trial bundle", "Tap to see what is inside your trial bundle."),
 ("getmysample", ["/getmysample"], ["YOUR FREE"], "SAMPLE", "POSTS MADE FOR YOUR CLINIC", "Get your free sample", "Send me your details and I will make a free sample of posts for your clinic."),
 ("sample", ["/sample/*"], ["YOUR FREE SAMPLE"], "IS READY", "TAP TO SEE AND DOWNLOAD IT", "Your free sample is ready", "Tap to see and download your free sample posts."),
 ("getmyposts", ["/getmyposts"], ["GET YOUR"], "POSTS", "MADE FOR YOUR CLINIC", "Get your posts", "Posts made for your clinic, ready to download."),
 ("pack", ["/pack/*"], ["YOUR POSTS"], "ARE READY", "TAP TO SEE AND DOWNLOAD THEM", "Your posts are ready", "Tap to see and download your posts."),
 ("over50", ["/over50"], ["TEN POSTS FOR"], "WOMEN OVER 50", "MADE FOR YOUR CLINIC", "Ten posts for women over 50", "Ten posts for your clinic to speak to women over 50."),
 ("photoshoot", ["/photoshoot"], ["20 PHOTOS OF"], "YOU", "AN AI PHOTO SHOOT FOR YOUR CLINIC", "20 photos of you", "An AI photo shoot of you, made for your clinic socials."),
 ("photos", ["/photos/*"], ["YOUR PHOTOS"], "ARE READY", "TAP TO SEE AND DOWNLOAD THEM", "Your photos are ready", "Tap to see and download your photos."),
 ("shop", ["/shop"], ["THE SOCIAL MEDIA"], "SISTER SHOP", "EVERYTHING I MAKE", "The Social Media Sister shop", "Everything I make for aesthetic clinics, in one place."),
 ("secretshop", ["/secretshop"], ["THE SECRET"], "SHOP", "JUST FOR YOU", "The secret shop", "Something extra, just for you."),
 ("10freeposts", ["/10freeposts"], ["10 FREE"], "POSTS", "MADE FOR YOUR CLINIC", "10 free posts for your clinic", "Ten free posts, stories and reel hooks made for your clinic."),
 ("club", ["/club", "/club/*"], ["YOUR CLUB"], "PORTAL", "YOUR MONTHLY CONTENT LIVES HERE", "Your club portal", "Your monthly content lives here."),
 ("youreinvited", ["/youreinvited"], ["YOU ARE"], "INVITED", "10 PLACES ONLY AND ONE IS FOR YOU", "You are invited", "A place is waiting for you in my monthly content club for aesthetic injectors."),
 ("yearpass", ["/yearpass/*"], ["YOUR YEAR"], "PASS", "A WHOLE YEAR OF CONTENT", "Your Year Pass", "Your whole year of clinic content lives here."),
 ("bundle", ["/bundle/*"], ["YOUR CONTENT"], "BUNDLE", "TAP TO SEE WHAT I HAVE MADE", "Your content bundle", "Tap to see what I have made for your clinic."),
 ("founder", ["/founder-signup", "/founder-welcome"], ["FOUNDER"], "SIGN UP", "JOIN THE FIRST CLINICS IN", "Founder sign up", "Join the first clinics in."),
 ("freecall", ["/freecall"], ["BOOK A"], "FREE CALL", "A CHAT ABOUT YOUR CLINIC SOCIALS", "Book a free call with me", "A chat about your clinic socials, no pressure."),
 ("coffee", ["/coffee"], ["LET'S HAVE A"], "CHAT", "TELL ME WHAT IS ON YOUR MIND", "Let's have a chat", "Pop your details in and tell me what is on your mind."),
 ("competition", ["/competition"], ["ENTER THE"], "COMPETITION", "WIN CONTENT DAYS AND DONE FOR YOU SOCIALS", "Enter the competition", "Win content days and done for you social media for your clinic."),
 ("podcast", ["/podcast"], ["THE SOCIAL MEDIA"], "SISTER PODCAST", "TAP TO LISTEN", "The Social Media Sister podcast", "Tap to listen."),
 ("rants", ["/rants", "/rant/*"], ["MY"], "RANTS", "STRAIGHT TALKING ABOUT CLINIC SOCIALS", "My rants", "Straight talking about clinic socials."),
 ("blog", ["/socialmediasister"], ["THE SOCIAL MEDIA"], "SISTER BLOG", "TIPS FOR AESTHETIC CLINICS", "The Social Media Sister blog", "Tips for aesthetic clinics."),
 ("about", ["/about"], ["ABOUT"], "VANESSA", "YOUR AESTHETIC ANGEL AND DIGITAL DEVIL", "About Vanessa", "Meet your aesthetic angel and digital devil."),
 ("bank", ["/bank/*"], ["YOUR CONTENT"], "BANK", "EVERYTHING I HAVE MADE FOR YOU", "Your content bank", "Everything I have made for your clinic."),
 ("preview", ["/preview/*"], ["YOUR CONTENT"], "PREVIEW", "HAVE A LOOK AT WHAT IS COMING", "Your content preview", "Have a look at what is coming for your clinic."),
 ("showcase", ["/showcase/*"], ["YOUR"], "SHOWCASE", "TAP TO WATCH", "Your showcase", "Tap to watch."),
 ("no1", ["/no1bodypostsready", "/no1feed"], ["YOUR POSTS"], "ARE READY", "NO 1 BODY SCULPTING", "Your posts are ready", "Tap to see and download your posts."),
]

def font(sz): return ImageFont.truetype(FONT, sz)
def spaced_w(d, t, f, sp): return sum(d.textlength(c, font=f) for c in t) + sp * (len(t) - 1)
def spaced(d, x, y, t, f, sp, fill):
    for c in t:
        d.text((x, y), c, font=f, fill=fill); x += d.textlength(c, font=f) + sp

def fit(d, t, maxw, start):
    s = start
    while d.textlength(t, font=font(s)) > maxw and s > 40: s -= 2
    return s

def make(lines, pink, sub, path):
    im = Image.new("RGB", (1200, 630), "white"); d = ImageDraw.Draw(im)
    d.rectangle([0, 0, 1200, 14], fill=PINK); d.rectangle([0, 616, 1200, 630], fill=BLACK)
    f = font(26); k = "SOCIAL MEDIA SISTER"; spaced(d, (1200 - spaced_w(d, k, f, 7)) / 2, 74, k, f, 7, PINK)
    rows = [(t, BLACK) for t in lines] + [(pink, PINK)]
    size = min(fit(d, t, 1000, 120) for t, _ in rows)
    gap = int(size * 1.12); total = gap * len(rows)
    y = 130 + (400 - total) / 2 + (gap - size) / 4
    for t, col in rows:
        ft = font(size); d.text(((1200 - d.textlength(t, font=ft)) / 2, y), t, font=ft, fill=col); y += gap
    ss = 26
    while spaced_w(d, sub, font(ss), 3) > 1000 and ss > 14: ss -= 1
    spaced(d, (1200 - spaced_w(d, sub, font(ss), 3)) / 2, 545, sub, font(ss), 3, GREY)
    im.save(path, optimize=True)

os.makedirs(OUT, exist_ok=True)
data = []
for i, paths, lines, pink, sub, title, desc in L:
    make(lines, pink, sub, os.path.join(OUT, f"{i}.png"))
    data.append({"id": i, "paths": paths, "title": title, "desc": desc})
ts = "// Made by scripts/make-link-previews.py. Titles and descriptions for the link previews of every client facing link.\nexport const PREVIEWS: { id: string; paths: string[]; title: string; desc: string }[] = " + json.dumps(data, indent=1, ensure_ascii=False) + ";\n"
open(os.path.join(ROOT, "netlify/edge-functions/lib/previews.ts"), "w").write(ts)
print("Paths for netlify.toml are already added; rerun adds nothing here.")
print(len(L), "pictures,", sum(len(e["paths"]) for e in data), "paths")
