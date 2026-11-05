from pathlib import Path
import hashlib,json,zipfile
folder=Path('server-download')
ids=['01a14458-4a04-7e0b-ae5f-3bf7cf63384c','01a14459-3933-77e4-9210-02efbb5e9bb3','01a14459-c03d-701f-a4dd-34cdb733b255']
target=folder/'PGY-workspace-0.1.107-server-reassembled.exe'
entries=[]
with target.open('wb') as out:
    for i,attachment in enumerate(ids,1):
        p=folder/f'PGY-01107-installer-{i}.zip'
        with zipfile.ZipFile(p) as z:
            expected=f'PGY-01107.part{i}.bin'
            assert z.namelist()==[expected],z.namelist()
            assert z.testzip() is None
            chunk=z.read(expected);out.write(chunk)
        entries.append(dict(attachment=attachment,filename=p.name,archiveBytes=p.stat().st_size,archiveSHA256=hashlib.sha256(p.read_bytes()).hexdigest(),partBytes=len(chunk),partSHA256=hashlib.sha256(chunk).hexdigest()))
digest=hashlib.sha256(target.read_bytes()).hexdigest()
result=dict(ok=digest=='9f034734f68828d45f9715206c159dedf2896496b6b5d28a59ccf0c9fc4955d1' and target.stat().st_size==109733324,source='Three freshly authenticated CLI downloads; no original local installer or volumes used',entries=entries,installerBytes=target.stat().st_size,installerSHA256=digest,executed=False)
Path('SERVER-DELIVERY-01107.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False,indent=2))
assert result['ok']
