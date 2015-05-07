. as $all
| .["@context"] as $context 
  | $context 
  | to_entries 
  | map(select(.value == {"@type": "@link"})) 
  | [ .[].key ] as $links 
| $all 
  | del(.["@context"]) 
  | to_entries 
  | map(select( [.key] as $keys 
              | $links 
              | contains($keys) 
              | not )) 
  | from_entries as $root 
| $all
  | del(.["@context"]) 
  | [ .. 
    | objects
    | to_entries
    | map(select( [.key] as $keys
                | $links 
                | contains($keys)))
    | reduce .[] as $item ( []
                          ; . + ( [ $item.value[] 
                                  | {"type": $item.key } + . 
                                  ] ) )   
    ] | reduce .[] as $item ( [] 
                            ; . + $item )
      |  . as $nodes
| $nodes 
  | [ .[]
    | to_entries 
    | map(select( [.key] as $keys 
                | $links 
                | contains($keys) 
                | not )) 
    | from_entries 
    ] as $nodes 
| ( [ $root ] + $nodes ) as $nodes
| [ $all
  | del(.["@context"])
  | ..
  | .["@id"]? as $id
  | $links[]
  | . as $link
  | $all
  | ..
  | objects
  | select(.["@id"] == $id)
  | to_entries 
  | map(select( [.key] as $keys 
              | [ $link ] 
              | contains($keys)))
  | [ .[].value[]
    | { source   : $id
      , relation : $link
      , target   : .["@id"]
      } ]
  ] | map(select(length !=0)) 
    | reduce .[] as $item ( [] 
                          ; . + $item )
    | . as $edges 
| { nodes: $nodes
  , edges: $edges 
  }