ดึง webhook จาก https://election69.event360plus.com/webhook/waffle Method GET จะได้ json data มา 1 ชุด
นำมาสร้าง waffle chart โดยมีจำนวนรวม 50 ที่นั่ง และแบ่งสี ตาม พรรค
{
"party": "อิสระ",
"count": 11,
"colorCode": "#ddddcc"
}
สร้าง web app ดึงข้อมูลทุกๆ 10 sec reload data แบบ silent (ไม่กระพริบทั้งหน้า จะให้กระพริบเฉพาะช่องที่อัปเดต) ขนาด 16:9 เพื่อนำไปขึ้นจอทีวี
สร้าง waffle chart ขนาด 5x10 (50 ช่อง) โดยแต่ละช่องจะมีขนาด 10x10 pixel และมีระยะห่าง 5 pixel
ด้านซ้ายจะเป็น chart ความกว้าง 60%
ด้านขวาจะเป็น list พรรค และจำนวน
