import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReaderAppearance } from './ReaderAppearance';
import { readerAppearance } from '../../lib/readerAppearance';
import type { AppSettings } from '../../lib/apiTypes';

const request=jest.fn();
const font={id:'font-1',label:'Noto Armenian',familyName:'Noto',subfamilyName:'Regular',format:'ttf',sha256:'a'.repeat(64),byteLength:200,supportsEnglish:true,supportsArmenian:true,archivedAt:null,available:true};
jest.mock('../../hooks/useApiClient',()=>({useApiClient:()=>({request})}));
jest.mock('../../hooks/useReaderFonts',()=>({useReaderFonts:()=>({data:{fonts:[font,
  {...font,id:'font-2',label:'English only',supportsArmenian:false},
  {...font,id:'font-3',label:'Archived font',archivedAt:'2026-10-26T10:00:00.000Z'},
  {...font,id:'font-4',label:'Missing file',available:false},
]},isError:false})}));
jest.mock('./useFontPreview',()=>({useFontPreview:()=>({family:undefined})}));
jest.mock('./ReaderPreview',()=>({ReaderPreview:()=> <p>Live lesson preview</p>}));
const settings:AppSettings={...readerAppearance({}),id:'global',updatedAt:'2026-10-27T10:00:00.000Z',createdAt:'',readingModes:[],wordRepetitionPauseMs:400,
  updatePolicyEnabled:false,latestAndroidBuildNumber:0,minAndroidBuildNumber:0,latestIosBuildNumber:0,minIosBuildNumber:0,androidStoreUrl:'',iosStoreUrl:'',updateMessage:'Update available.'};
function setup(){const client=new QueryClient();return render(<ReaderAppearance settings={settings}/>,{
  wrapper:({children})=><QueryClientProvider client={client}>{children}</QueryClientProvider>,
});}
beforeEach(()=>request.mockReset());

it('saves independent gaps without sending playback or vocabulary settings',async()=>{
  request.mockResolvedValue({settings:{...settings,translationGap:7,readingRowGap:16,updatedAt:'2026-10-27T11:00:00.000Z'}});setup();
  await userEvent.click(screen.getByRole('button',{name:'Spacing'}));
  fireEvent.change(screen.getByRole('spinbutton',{name:/Translation-to-English gap/}),{target:{value:'7'}});
  fireEvent.change(screen.getByRole('spinbutton',{name:/Gap between reading rows/}),{target:{value:'16'}});
  await userEvent.click(screen.getByRole('button',{name:'Save reader appearance'}));
  await screen.findByRole('status');
  const payload=JSON.parse(request.mock.calls[0][1].body);
  expect(payload).toMatchObject({translationGap:7,readingRowGap:16,expectedUpdatedAt:settings.updatedAt});
  expect(payload).not.toHaveProperty('wordRepetitionPauseMs');expect(payload).not.toHaveProperty('readingModes');
});
it('filters Armenian fonts, selects a real uploaded font and rejects invalid fitting bounds',async()=>{
  setup();await userEvent.click(screen.getByRole('button',{name:'Armenian'}));
  const select=screen.getByRole('combobox',{name:'Armenian font'});
  expect(select).toHaveTextContent('Noto Armenian');expect(select).not.toHaveTextContent('English only');
  await userEvent.selectOptions(select,'font-1');
  fireEvent.change(screen.getByRole('spinbutton',{name:/Minimum translation size/}),{target:{value:'20'}});
  expect(screen.getByRole('button',{name:'Save reader appearance'})).toBeDisabled();
  expect(screen.getByRole('alert')).toHaveTextContent('minimum size');expect(request).not.toHaveBeenCalled();
});
it('retains drafts on stale-save errors and allows discarding them',async()=>{
  request.mockRejectedValue(new Error('Settings changed in another session.'));setup();
  fireEvent.change(screen.getByRole('spinbutton',{name:/English font size/}),{target:{value:'25'}});
  await userEvent.click(screen.getByRole('button',{name:'Save reader appearance'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('another session');
  expect(screen.getByRole('spinbutton',{name:/English font size/})).toHaveValue(25);
  await userEvent.click(screen.getByRole('button',{name:'Discard changes'}));
  expect(screen.getByRole('spinbutton',{name:/English font size/})).toHaveValue(18);
});
it('uploads a font file and explains that appearance must be saved separately',async()=>{
  request.mockResolvedValue({font});setup();await userEvent.click(screen.getByRole('button',{name:'Fonts'}));
  await userEvent.type(screen.getByRole('textbox',{name:'Font label'}),'New font');
  await userEvent.upload(screen.getByLabelText('Font file'),new File(['fake-test-bytes'],'Noto.ttf',{type:'font/ttf'}));
  await userEvent.click(screen.getByRole('button',{name:'Upload font'}));
  await waitFor(()=>expect(request).toHaveBeenCalledWith('/admin/reader-fonts',expect.objectContaining({method:'POST'})));
  expect(await screen.findByRole('status')).toHaveTextContent('Use for English or Use for Armenian');
});

it('selects uploaded fonts directly in the library, previews the choices across tabs and saves only on request',async()=>{
  setup();await userEvent.click(screen.getByRole('button',{name:'Fonts'}));
  const row=within(screen.getByRole('listitem',{name:'Noto Armenian'}));
  await userEvent.click(row.getByRole('button',{name:'Use for Armenian'}));
  await userEvent.click(row.getByRole('button',{name:'Use for English'}));
  expect(row.getByRole('button',{name:'Selected for Armenian'})).toHaveAttribute('aria-pressed','true');
  expect(row.getByRole('button',{name:'Selected for English'})).toHaveAttribute('aria-pressed','true');
  expect(request).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button',{name:'Armenian'}));
  expect(screen.getByRole('combobox',{name:'Armenian font'})).toHaveValue('font-1');
  await userEvent.click(screen.getByRole('button',{name:'English'}));
  expect(screen.getByRole('combobox',{name:'English font'})).toHaveValue('font-1');
  request.mockResolvedValue({settings:{...settings,mainTextFontId:'font-1',translationFontId:'font-1',updatedAt:'2026-10-27T11:00:00.000Z'}});
  await userEvent.click(screen.getByRole('button',{name:'Save reader appearance'}));
  await screen.findByRole('status');
  expect(JSON.parse(request.mock.calls[0][1].body)).toMatchObject({mainTextFontId:'font-1',translationFontId:'font-1',expectedUpdatedAt:settings.updatedAt});
});

it('allows discarding library selections and prevents selecting unavailable or unsupported fonts',async()=>{
  setup();await userEvent.click(screen.getByRole('button',{name:'Fonts'}));
  const row=within(screen.getByRole('listitem',{name:'Noto Armenian'}));
  await userEvent.click(row.getByRole('button',{name:'Use for Armenian'}));
  await userEvent.click(screen.getByRole('button',{name:'Discard changes'}));
  expect(row.getByRole('button',{name:'Use for Armenian'})).toHaveAttribute('aria-pressed','false');
  expect(within(screen.getByRole('listitem',{name:'English only'})).queryByRole('button',{name:'Use for Armenian'})).not.toBeInTheDocument();
  const archived=within(screen.getByRole('listitem',{name:'Archived font'}));
  expect(archived.getByRole('button',{name:'Use for Armenian'})).toBeDisabled();
  expect(archived.getByText('Restore this font to select it.')).toBeInTheDocument();
  const unavailable=within(screen.getByRole('listitem',{name:'Missing file'}));
  expect(unavailable.getByRole('button',{name:'Use for English'})).toBeDisabled();
  expect(unavailable.getByText('Upload this font file again to make it available.')).toBeInTheDocument();
  expect(request).not.toHaveBeenCalled();
});

it('keeps a font draft and refreshes its save version after unrelated reading-mode changes',async()=>{
  const view=setup();
  await userEvent.selectOptions(screen.getByRole('combobox',{name:'English font'}),'font-1');
  fireEvent.change(screen.getByRole('spinbutton',{name:/English font size/}),{target:{value:'25'}});
  const updated={...settings,wordRepetitionPauseMs:800,updatedAt:'2026-10-27T11:00:00.000Z'};
  view.rerender(<ReaderAppearance settings={updated}/>);
  request.mockResolvedValue({settings:{...updated,mainTextFontId:'font-1',mainTextFontSize:25,updatedAt:'2026-10-27T12:00:00.000Z'}});
  await userEvent.click(screen.getByRole('button',{name:'Save reader appearance'}));
  await screen.findByRole('status');
  expect(JSON.parse(request.mock.calls[0][1].body)).toMatchObject({mainTextFontId:'font-1',mainTextFontSize:25,expectedUpdatedAt:updated.updatedAt});
  expect(screen.getByRole('spinbutton',{name:/English font size/})).toHaveValue(25);
});

it('protects an unsaved appearance draft from conflicting appearance changes',async()=>{
  const view=setup();
  fireEvent.change(screen.getByRole('spinbutton',{name:/English font size/}),{target:{value:'25'}});
  const updated={...settings,mainTextFontSize:28,updatedAt:'2026-10-27T11:00:00.000Z'};
  view.rerender(<ReaderAppearance settings={updated}/>);
  request.mockRejectedValue(new Error('Settings changed in another session.'));
  await userEvent.click(screen.getByRole('button',{name:'Save reader appearance'}));
  await screen.findByRole('alert');
  expect(JSON.parse(request.mock.calls[0][1].body).expectedUpdatedAt).toBe(settings.updatedAt);
  expect(screen.getByRole('spinbutton',{name:/English font size/})).toHaveValue(25);
  await userEvent.click(screen.getByRole('button',{name:'Discard changes'}));
  expect(screen.getByRole('spinbutton',{name:/English font size/})).toHaveValue(28);
});

it('refreshes a clean appearance form when a saved font changes elsewhere',()=>{
  const view=setup();
  view.rerender(<ReaderAppearance settings={{...settings,mainTextFontId:'font-1',updatedAt:'2026-10-27T11:00:00.000Z'}}/>);
  expect(screen.getByRole('combobox',{name:'English font'})).toHaveValue('font-1');
});
